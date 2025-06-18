# Rinha de Backend – API de Transações Bancárias

Esta API controla transações bancárias com alta performance e consistência de dados usando Go, PostgreSQL e Nginx.

### Construindo e Executando os Containers

Execute o seguinte comando para construir e iniciar os containers:

```bash
docker-compose up --build -d
```

### Acessando a API

A API estará acessível através do Nginx na porta 9999. Você pode fazer requisições HTTP para os endpoints disponíveis.

### Executando Testes de Carga

Para executar os testes de carga, use o seguinte comando:

```bash
k6 run load-test.js
```

### Parando os Containers

Para parar os containers, execute:

```bash
docker-compose down
```

Para rodar o sistema clone o repositório, entre na pasta e execute o comando `docker-compose up --build -d`. O Nginx sobe na porta 9999 e distribui as requisições para duas instâncias da API que acessam o banco PostgreSQL dentro da mesma rede Docker.

Para testar carga extrema instale o k6 (por exemplo `brew install k6`) e execute `k6 run load-test.js`. O script gera quinhentos usuários virtuais nos primeiros cinco segundos, aumenta para mil nos próximos dez.

O Nginx usa o algoritmo least connection, mantém cem conexões keep-alive por upstream, aplica time-outs de cinco segundos e possui um circuito simples de troca de upstream em caso de erro. A API em Go valida entrada (`valor` positivo, `tipo` crédito ou débito, `descricao` com até dez caracteres), executa tudo dentro de transações ACID, mantém um cache em memória de dois segundos para o endpoint de extrato e usa um pool de conexões pgx para evitar custos de handshake. O banco PostgreSQL aceita até duzentas conexões e possui índice em `transacoes(cliente_id, realizada_em desc)` para acelerar os extratos.

Fatores que garantem desempenho: linguagem Go com goroutines, Nginx na frente mantendo conexões abertas, pool de conexões em todas as camadas, uso de SQL preparado com índices adequados e limitação explícita de CPU e memória em cada container para evitar interferência entre serviços.

A segurança é por validação de dados, uso exclusivo de statements preparados, isolamento de rede onde apenas o Nginx expõe porta pública e rate limiting interno. A observabilidade vem de logs estruturados no Nginx e na API, do endpoint de extrato usado como health check e das métricas de latência e erro produzidas pelo k6 durante os testes.
