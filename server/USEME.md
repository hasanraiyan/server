# API Documentation

## Introduction

This API provides endpoints for user authentication, including registration, login, email verification, and password management.

## Authentication Endpoints

1. **POST /auth/register**
    - **Description**: Register a new user.
    - **Request Body**:
        ```json
        {
            "username": "string (required)",
            "email": "string (required)",
            "password": "string (required, minimum 6 characters)",
            "name": "string (required)"
        }
        ```

2. **POST /auth/login**
    - **Description**: Authenticate a user and receive a JWT.
    - **Request Body**:
        ```json
        {
            "email": "string (required)",
            "password": "string (required)"
        }
        ```

3. **GET /auth/verify-email/:token**
    - **Description**: Verify user's email with the provided token.

4. **POST /auth/forgot-password**
    - **Description**: Request a password reset link.
    - **Request Body**:
        ```json
        {
            "email": "string (required)"
        }
        ```

5. **GET /auth/reset-password/:token**
    - **Description**: Render a form for resetting the password. (Optional)

6. **POST /auth/reset-password/:token**
    - **Description**: Reset the user's password.
    - **Request Body**:
        ```json
        {
            "newPassword": "string (required, minimum 6 characters)"
        }
        ```

7. **GET /auth/profile**
    - **Description**: Retrieve user profile information. Requires a valid JWT token.

## User Model

The user model consists of the following fields:

- **name**: String (required)
- **username**: String (required, unique)
- **email**: String (required, unique, lowercase)
- **passwordHash**: String (required)
- **isVerified**: Boolean (defaults to false)
- **verificationToken**: String
- **resetPasswordToken**: String
- **resetPasswordExpires**: Date

Timestamp fields are automatically added to track when the user was created or updated.

## Conclusion

This `USEME.md` file serves as a basic guide to using the authentication API. Ensure that all requests are structured according to the provided specifications.
