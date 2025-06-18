package main

import (
    "context"
    "net/http"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/patrickmn/go-cache"
)

var extratoCache *cache.Cache

type TransacaoReq struct {
    Valor     int    `json:"valor" binding:"required,min=1"`
    Tipo      string `json:"tipo"  binding:"required,oneof=c d"`
    Descricao string `json:"descricao" binding:"required,max=10"`
}

func main() {
    InitDB()
    extratoCache = cache.New(2*time.Second, 5*time.Second)
    r := gin.Default()
    r.POST("/clientes/:id/transacoes", transacao)
    r.GET("/clientes/:id/extrato", extrato)
    r.Run(":8080")
}

func transacao(c *gin.Context) {
    id := c.Param("id")
    var req TransacaoReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.Status(http.StatusUnprocessableEntity)
        return
    }

    ctx := context.Background()
    tx, _ := pool.Begin(ctx)
    defer tx.Rollback(ctx)

    var saldo, limite int
    tx.QueryRow(ctx, "SELECT saldo, limite FROM clientes WHERE id=$1", id).Scan(&saldo, &limite)

    novoSaldo := saldo
    if req.Tipo == "c" {
        novoSaldo += req.Valor
    } else {
        novoSaldo -= req.Valor
    }

    if novoSaldo < -limite {
        c.Status(http.StatusUnprocessableEntity)
        return
    }

    tx.Exec(ctx, "UPDATE clientes SET saldo=$1 WHERE id=$2", novoSaldo, id)
    tx.Exec(ctx, "INSERT INTO transacoes (cliente_id, valor, tipo, descricao) VALUES ($1,$2,$3,$4)",
        id, req.Valor, req.Tipo, req.Descricao)
    tx.Commit(ctx)

    // Invalidate cache for this cliente
    extratoCache.Delete(id)

    c.JSON(http.StatusOK, gin.H{"limite": limite, "saldo": novoSaldo})
}

func extrato(c *gin.Context) {
    id := c.Param("id")

    // Check cache first
    if data, found := extratoCache.Get(id); found {
        c.JSON(http.StatusOK, data)
        return
    }

    ctx := context.Background()

    var saldo, limite int
    var atual time.Time
    pool.QueryRow(ctx, "SELECT saldo, limite, now() FROM clientes WHERE id=$1", id).Scan(&saldo, &limite, &atual)

    rows, _ := pool.Query(ctx, "SELECT valor,tipo,descricao,realizada_em FROM transacoes WHERE cliente_id=$1 ORDER BY realizada_em DESC LIMIT 10", id)
    var ult []gin.H
    for rows.Next() {
        var v int
        var t, d string
        var r time.Time
        rows.Scan(&v, &t, &d, &r)
        ult = append(ult, gin.H{"valor": v, "tipo": t, "descricao": d, "realizada_em": r})
    }
    response := gin.H{
        "saldo": gin.H{"total": saldo, "data_extrato": atual, "limite": limite},
        "ultimas_transacoes": ult,
    }

    // Store in cache
    extratoCache.Set(id, response, cache.DefaultExpiration)

    c.JSON(http.StatusOK, response)
} 