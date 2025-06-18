CREATE TABLE clientes (
    id       SERIAL PRIMARY KEY,
    nome     TEXT    NOT NULL,
    limite   INT     NOT NULL,
    saldo    INT     NOT NULL DEFAULT 0
);

CREATE TABLE transacoes (
    id            BIGSERIAL PRIMARY KEY,
    cliente_id    INT  NOT NULL REFERENCES clientes(id),
    valor         INT  NOT NULL,
    tipo          CHAR(1) NOT NULL CHECK (tipo IN ('c','d')),
    descricao     VARCHAR(10) NOT NULL,
    realizada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transacoes_cliente_data
  ON transacoes (cliente_id, realizada_em DESC);

-- seed (5 clientes – id 1-5)
INSERT INTO clientes (nome, limite)
VALUES ('o barato sai caro', 100_000),
       ('zan corp ltda',       80_000),
       ('les cruders',       1_000_000),
       ('padaria joia',    10_000_000),
       ('kid mais',          500_000); 