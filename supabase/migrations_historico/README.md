# Migraciones históricas

Migraciones aplicadas antes del 27 de octubre de 2026. **No se ejecutan**: el
esquema actual completo está en `supabase/migrations/20261027100000_esquema_base.sql`.

Se conservan como registro de cómo evolucionó la base. Las anteriores a
`20261024000000` no reconstruían producción (las tablas base se crearon fuera
de las migraciones); las de las fases 0, 1 y 2 (`20261024*` a `20261027000200`)
sí se aplicaron tal cual y su efecto está incluido en el esquema base.
