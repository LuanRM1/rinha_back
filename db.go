package main

import (
    "context"
    "os"
    "github.com/jackc/pgx/v5/pgxpool"
)

var pool *pgxpool.Pool

func InitDB() {
    url := os.Getenv("DATABASE_URL")
    cfg, _ := pgxpool.ParseConfig(url)
    cfg.MaxConns = 25
    pool, _ = pgxpool.NewWithConfig(context.Background(), cfg)
} 