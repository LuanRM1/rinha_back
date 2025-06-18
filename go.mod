module rinha-backend

go 1.22

require (
	github.com/gin-gonic/gin v1.8.1
	github.com/jackc/pgx/v5 v5.4.3
	github.com/patrickmn/go-cache v2.1.0+incompatible
)

// Forçar versões específicas para evitar incompatibilidade
replace (
	github.com/go-playground/validator/v10 => github.com/go-playground/validator/v10 v10.11.2
	github.com/rogpeppe/go-internal => github.com/rogpeppe/go-internal v1.9.0
)
