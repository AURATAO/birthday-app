package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file, using environment variables")
	}

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

	// Routes (we'll fill these in next)
	api := r.Group("/api")
	{
		api.POST("/birthdays", createBirthday)
		api.GET("/birthdays", getBirthdays)
		api.POST("/voice/parse", parseVoice)
		api.POST("/card/generate", generateCard)
		api.POST("/card/send", sendCard)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on :%s", port)
	r.Run(":" + port)
}
