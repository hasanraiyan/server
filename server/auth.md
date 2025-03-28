# Authentication API Documentation

This document describes the API endpoints for the authentication system.

## Password Storage

Passwords are not stored directly in the database. Instead, they are hashed using the `bcryptjs` library. During registration, the password is first salted using `bcrypt.genSalt(10)` and then hashed using `bcrypt.hash(password, salt)`. The resulting hash is stored in the `passwordHash` field in the database.

During login, the entered password is also hashed using `bcrypt.compare(password, user.passwordHash)` to compare it against the stored hash. This ensures that the actual password is never stored in the database, only its hash.

## Base URL

All API endpoints are relative to the base URL: `/auth`

## Endpoints

### 1. Register

*   **Method:** POST
*   **URL:** `/register`
*   **Description:** Registers a new user.
*   **Request Body:**
    ```json
    {
      "username": "johndoe",
      "email": "user@example.com",
      "password": "password123"
    }
    ```
*   **Response Codes:**
    *   201 Created: Registration successful. Check your email to verify your account.
    *   400 Bad Request: Username, email, and password are required / Invalid email format / Password must be at least 6 characters long.
    *   409 Conflict: Username already taken / Email already registered.
    *   500 Internal Server Error: Internal server error during registration.

### 2. Verify Email

*   **Method:** GET
*   **URL:** `/verify-email/:token`
*   **Description:** Verifies a user's email address using a token sent in the email.
*   **Path Parameters:**
    *   `token`: The verification token.
*   **Response Codes:**
    *   200 OK: Email verified successfully!
    *   400 Bad Request: Invalid or expired verification link.
    *   500 Internal Server Error: Internal server error during email verification.

### 3. Login

*   **Method:** POST
*   **URL:** `/login`
*   **Description:** Logs in an existing user and returns a JWT.
*   **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123"
    }
    ```
*   **Response Codes:**
    *   200 OK: Login successful.
        ```json
        {
          "message": "Login successful",
          "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        }
        ```
    *   400 Bad Request: Email and password are required.
    *   401 Unauthorized: Invalid credentials.
    *   403 Forbidden: Email not verified. Please check your inbox.
    *   500 Internal Server Error: Internal server error during login.

### 4. Forgot Password

*   **Method:** POST
*   **URL:** `/forgot-password`
*   **Description:** Initiates the password reset process by sending a reset link to the user's email.
*   **Request Body:**
    ```json
    {
      "email": "user@example.com"
    }
    ```
*   **Response Codes:**
    *   200 OK: If an account with that email exists, a password reset link has been sent.
    *   400 Bad Request: Email is required.
    *   500 Internal Server Error: Internal server error during forgot password.

### 5. Reset Password (Form)

*   **Method:** GET
*   **URL:** `/reset-password/:token`
*   **Description:** Renders a form where the user can enter their new password.
*   **Path Parameters:**
    *   `token`: The reset token.
*   **Response Codes:**
    *   200 OK: Returns an HTML form for resetting the password.
    *   400 Bad Request: Invalid or expired reset token.
    *   500 Internal Server Error: Internal server error while rendering reset password form.

### 6. Reset Password (Submit)

*   **Method:** POST
*   **URL:** `/reset-password/:token`
*   **Description:** Resets the user's password with a new password.
*   **Path Parameters:**
    *   `token`: The reset token.
*   **Request Body:**
    ```json
    {
      "newPassword": "newPassword123"
    }
    ```
*   **Response Codes:**
    *   200 OK: Password Reset Successfully!
    *   400 Bad Request: New password is required / Password must be at least 6 characters long / Invalid or expired reset token.
    *   500 Internal Server Error: Internal server error during password reset.
