package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func DeleteAccount(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := fmt.Sprintf("%v", userID)

	ctx := context.Background()

	// 1. Soft-delete all people belonging to this user.
	_, err := DB.Exec(ctx,
		`UPDATE people SET deleted_at = NOW()
		 WHERE user_id = $1 AND deleted_at IS NULL`,
		uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete people: " + err.Error()})
		return
	}

	// 2. Hard-delete cards that belong to this user's events.
	_, err = DB.Exec(ctx,
		`DELETE FROM cards
		 WHERE birthday_id IN (SELECT id FROM events WHERE user_id = $1)`,
		uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete cards: " + err.Error()})
		return
	}

	// 3. Hard-delete events.
	_, err = DB.Exec(ctx,
		`DELETE FROM events WHERE user_id = $1`, uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete events: " + err.Error()})
		return
	}

	// 4. Hard-delete push tokens.
	_, err = DB.Exec(ctx,
		`DELETE FROM push_tokens WHERE user_id = $1`, uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete push tokens: " + err.Error()})
		return
	}

	// 5. Delete the Supabase auth user via the Admin API.
	//    Requires SUPABASE_SERVICE_ROLE_KEY — distinct from the anon key.
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	supabaseURL := os.Getenv("SUPABASE_URL")
	if serviceKey == "" || supabaseURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "supabase admin credentials not configured"})
		return
	}

	adminReq, err := http.NewRequestWithContext(ctx,
		http.MethodDelete,
		supabaseURL+"/auth/v1/admin/users/"+uid,
		nil,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build admin request: " + err.Error()})
		return
	}
	adminReq.Header.Set("apikey", serviceKey)
	adminReq.Header.Set("Authorization", "Bearer "+serviceKey)

	resp, err := http.DefaultClient.Do(adminReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "supabase admin request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("supabase returned %d", resp.StatusCode)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
