-- Usuarios iniciales para AbogApp (cPanel/MySQL)
-- Contraseñas originales:
-- jmgorrono => Alexturner505.
-- cgorrono => Cpcgv1614.
-- ijara => Benja1937
-- admin => R@bula04
--
-- Nota: el login de la app valida formato email en frontend,
-- por eso se usan correos del dominio gjabogados.cl.

INSERT INTO abogapp_users (email, nombre, password_hash, is_admin, active)
VALUES
  ('jmgorrono@gjabogados.cl', 'jmgorrono', '$2y$12$b6cd5zkb33NHFZZHZxkzMOHAqdMKcPnmIIi91HEM.zCw7UhcdBOjO', 1, 1),
  ('cgorrono@gjabogados.cl', 'cgorrono', '$2y$12$KLgi3xubyKS2FdvUu/.dbOth23gw6yzZyCzHJvqgimkn6URUKLiUu', 1, 1),
  ('ijara@gjabogados.cl', 'ijara', '$2y$12$UEe.N7v1FwHr5TZUhJfVPOp3kuSV6SAnukpoJ4TwVj0qf.sk25TvS', 1, 1),
  ('admin@gjabogados.cl', 'Administrador', '$2y$12$Up2MpbR5NJAYQ1.T2Nme.eXhC/bSqXR9AjSxokFdKJYFiCNOp.C1m', 1, 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  password_hash = VALUES(password_hash),
  is_admin = VALUES(is_admin),
  active = VALUES(active);
