-- ============================================================================
-- EstupeFarma — esquema inicial en Supabase (sustituye a las pestañas de Sheets)
--
-- Principios:
--   * Una tabla por pestaña del Sheet. `id` es el mismo texto que genera la app.
--   * Tipos reales (enteros, fechas, booleanos) en lugar de celdas sin tipo.
--   * Claves que la app añada en el futuro y no tengan columna → `extra jsonb`
--     (la capa de datos del frontend las guarda y las devuelve tal cual).
--   * NUNCA datos de pacientes (CLAUDE.md §1). `medico`/`usuario`/`farmaceutico`
--     son personal sanitario.
--   * Sin borrados: ni la app ni la clave pública pueden hacer DELETE/TRUNCATE.
--   * Auditoría inmutable de todo INSERT/UPDATE en el esquema `auditoria`.
--   * Fase 1 SIN cuentas de usuario: el rol `anon` lee, crea y actualiza.
--     Fase 2 (tras el merge): las políticas pasan a `authenticated`.
-- ============================================================================

-- Las fechas sin zona horaria se interpretan en hora de Canarias, igual que hacía Sheets.
alter database postgres set timezone to 'Atlantic/Canary';

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogo de medicamentos (Código V) y configuración compartida
-- ---------------------------------------------------------------------------
create table public.catalogo (
  id          text primary key,
  codigo_v    text not null unique check (codigo_v ~ '^[A-Z][0-9]{5}$'),
  nombre      text not null,
  grupo       text not null check (grupo in ('ORAL', 'IV')),
  min         integer check (min >= 0),
  max         integer check (max >= 0),
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.catalogo is 'Catálogo oficial de estupefacientes por Código V con umbrales MIN/MAX.';

-- Filas especiales que en Sheets vivían dentro de "Catalogo" (__config__, __cncatalog__, __declaraciones__)
create table public.app_config (
  id          text primary key check (id ~ '^__[a-z_]+__$'),
  nombre      text,
  json        text,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.app_config is 'Ajustes compartidos de la app (config, catálogo CN, declaraciones) como JSON.';

-- ---------------------------------------------------------------------------
-- F1/F2 — Inventarios
-- ---------------------------------------------------------------------------
create table public.inventarios (
  id                text primary key,
  fecha             timestamptz,
  grupo             text check (grupo in ('ORAL', 'IV')),
  codigo_v          text,
  nombre            text,
  real              integer check (real >= 0),
  d07               integer,
  maestro           integer,
  desc_real_d07     integer,
  desc_d07_maestro  integer,
  extra             jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index inventarios_fecha_idx on public.inventarios (fecha);
create index inventarios_codigo_v_idx on public.inventarios (codigo_v);

-- ---------------------------------------------------------------------------
-- F4 — Pedidos (único sitio donde se usa el CN)
-- ---------------------------------------------------------------------------
create table public.pedidos (
  id                   text primary key,
  vale                 text,
  cn                   text,
  estupefaciente       text,
  proveedor            text,
  fecha_pedido         timestamptz,
  uds_pedidas          integer check (uds_pedidas >= 0),
  uds                  integer check (uds >= 0),
  uds_recibidas        integer check (uds_recibidas >= 0),
  fecha_entrada        timestamptz,
  farmaceutico         text,
  no_servido           boolean not null default false,
  incidencias          text,
  incidencias_previas  text,
  aviso_llegada        boolean not null default false,
  hora_aviso           timestamptz,
  estado               text check (estado in ('Pendiente', 'Recibido', 'Incidencia', 'No servido')),
  extra                jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- Índice NO único de momento: hay 3 vales repetidos en los datos actuales.
-- Cuando se resuelvan, se sustituye por un índice único (migración aparte).
create index pedidos_vale_idx on public.pedidos (lower(btrim(vale)));
create index pedidos_fecha_pedido_idx on public.pedidos (fecha_pedido);

-- ---------------------------------------------------------------------------
-- F5 — Caducados
-- ---------------------------------------------------------------------------
create table public.caducados (
  id               text primary key,
  cn               text,
  nombre           text,
  lote             text,
  fecha_caducidad  timestamptz,
  unidades         integer check (unidades >= 0),
  declaracion      text,
  extra            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- F6 — Incidencias
-- ---------------------------------------------------------------------------
create table public.incidencias (
  id            text primary key,
  tipo          text,
  tipo_otro     text,
  medicamento   text,
  fecha_hora    timestamptz,
  movimiento    text,
  cantidad      integer,
  sistema       text,
  descripcion   text,
  medida        text,
  estado        text check (estado in ('Pendiente', 'En revisión', 'Resuelta')),
  farmaceutico  text,
  extra         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- F3 — Cruces del Detector y Alertas accionables
-- ---------------------------------------------------------------------------
create table public.cruces (
  id           text primary key,
  medicamento  text,
  codigo_v     text,
  fecha        timestamptz,
  tipo         text,
  medico       text,   -- prescriptor (personal), nunca paciente
  cantidad     numeric,
  cant_final   numeric, -- puede ser negativo: es justo lo que detecta E08
  usuario      text,
  alertas      text,
  nivel        text,
  intervalo    text,
  extra        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index cruces_fecha_idx on public.cruces (fecha);

create table public.alertas (
  id           text primary key,
  origen       text,
  tipo         text,
  codigos      text,
  codigo_v     text,
  medicamento  text,
  nivel        text,
  fecha        timestamptz,
  detalle      text,
  estado       text check (estado in ('pendiente', 'hecha', 'descartada')),
  extra        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- F7 — Previsión: consumo medio por Código V
-- ---------------------------------------------------------------------------
create table public.consumos (
  id           text primary key,
  codigo_v     text,
  media        numeric check (media >= 0),
  origen       text,
  fecha_carga  timestamptz,
  extra        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['catalogo','app_config','inventarios','pedidos','caducados','incidencias','cruces','alertas','consumos'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.tocar_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ============================================================================
-- AUDITORÍA INMUTABLE
-- Cada INSERT/UPDATE (y cualquier DELETE que se hiciera con privilegios de
-- administrador) deja una fila con el antes y el después. El esquema no está
-- expuesto en la API y nadie salvo el propietario puede leerlo ni modificarlo.
-- ============================================================================
create schema auditoria;
revoke all on schema auditoria from public, anon, authenticated;

create table auditoria.registro (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  tabla      text not null,
  fila_id    text,
  accion     text not null,
  rol        text,
  usuario    text,          -- se rellenará en la Fase 2 (cuentas de usuario)
  antes      jsonb,
  despues    jsonb
);
revoke all on auditoria.registro from public, anon, authenticated;

create or replace function auditoria.registrar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  insert into auditoria.registro (tabla, fila_id, accion, rol, usuario, antes, despues)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, null),
    tg_op,
    coalesce(claims->>'role', current_user),
    claims->>'email',
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function auditoria.registrar() from public, anon, authenticated;

-- El propio registro no se puede alterar ni borrar (ni siquiera por error desde SQL)
create or replace function auditoria.bloquear_cambios()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'El registro de auditoría es de solo inserción';
end $$;
create trigger registro_inmutable before update or delete on auditoria.registro
  for each row execute function auditoria.bloquear_cambios();
create trigger registro_sin_truncate before truncate on auditoria.registro
  for each statement execute function auditoria.bloquear_cambios();

do $$
declare t text;
begin
  foreach t in array array['catalogo','app_config','inventarios','pedidos','caducados','incidencias','cruces','alertas','consumos'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function auditoria.registrar()', t || '_auditoria', t);
  end loop;
end $$;

-- ============================================================================
-- SEGURIDAD: RLS en todas las tablas, sin DELETE para nadie desde la API
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['catalogo','app_config','inventarios','pedidos','caducados','incidencias','cruces','alertas','consumos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke delete, truncate on public.%I from anon, authenticated', t);
    -- Fase 1 (sin cuentas): la app usa la clave pública (rol anon)
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_leer', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)', t || '_crear', t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)', t || '_editar', t);
    -- Deliberadamente NO hay política de DELETE.
  end loop;
end $$;

-- ============================================================================
-- REALTIME: los cambios de un equipo llegan al resto al momento
-- ============================================================================
alter publication supabase_realtime add table
  public.catalogo, public.app_config, public.inventarios, public.pedidos,
  public.caducados, public.incidencias, public.cruces, public.alertas, public.consumos;
