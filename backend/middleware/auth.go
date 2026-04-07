package middleware

import (
	"encoding/json"
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
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		token := strings.Replace(authHeader, "Bearer ", "", 1)

		req, _ := http.NewRequest("GET",
			os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != 200 {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		var user SupabaseUser
		json.NewDecoder(resp.Body).Decode(&user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}
