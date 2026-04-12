package main

import (
	"context"
	"log"
	"os"

	"birthday-app/handlers"
	"birthday-app/middleware"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file, using environment variables")
	}

	// Connect to Supabase via pgx pool
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	handlers.InitDB(pool)

	r := gin.Default()

	// CORS — allow Next.js frontend
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		api.POST("/people", handlers.CreatePerson)
		api.PUT("/people/:id", handlers.UpdatePerson)
		api.DELETE("/people/:id", handlers.DeletePerson)

		api.POST("/events", handlers.CreateEvent)
		api.GET("/events/upcoming", handlers.GetUpcomingEvents)
		api.GET("/events/:id", handlers.GetEvent)

		api.POST("/voice/parse", handlers.ParseVoice)

		api.POST("/card/generate", handlers.GenerateCard)
		api.PUT("/card/:id", handlers.UpdateCard)
		api.DELETE("/card/:id", handlers.DeleteCard)
		api.POST("/card/:id/send", handlers.SendCard)

		api.POST("/push-token", handlers.SavePushToken)

		api.DELETE("/account", handlers.DeleteAccount)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on :%s", port)
	r.Run(":" + port)
}
