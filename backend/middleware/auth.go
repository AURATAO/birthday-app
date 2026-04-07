package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type SupabaseUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		log.Printf("Auth header: %s", authHeader)

		if authHeader == "" {
			log.Printf("No auth header found")
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		token := strings.Replace(authHeader, "Bearer ", "", 1)
		log.Printf("Token length: %d", len(token))

		req, _ := http.NewRequest("GET",
			os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header["apikey"] = []string{os.Getenv("SUPABASE_ANON_KEY")}

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Auth failed: err=%v", err)
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		log.Printf("Supabase response status: %d", resp.StatusCode)

		if resp.StatusCode != 200 {
			log.Printf("Auth failed: status=%d", resp.StatusCode)
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		var user SupabaseUser
		json.NewDecoder(resp.Body).Decode(&user)
		log.Printf("User ID: %s", user.ID)
		c.Set("user_id", user.ID)
		c.Next()
	}
}
