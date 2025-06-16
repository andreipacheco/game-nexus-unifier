# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5d71e49f-fe12-4989-b263-cce310d352a6

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5d71e49f-fe12-4989-b263-cce310d352a6) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Server Configuration & Database

The backend server, located in the `server/` directory, requires additional configuration, especially for database connectivity.

### MongoDB Integration

This application uses MongoDB to cache Steam game data retrieved from the Steam API. This caching mechanism significantly improves performance for subsequent requests for the same user's game data, reducing load times and minimizing redundant API calls to Steam.

**Required Environment Variable:**

*   `MONGODB_URI`: Your MongoDB connection string.

This variable **must** be defined in a `.env` file located in the `server/` directory (i.e., `server/.env`).

Example `server/.env` file:
```
MONGODB_URI=mongodb://localhost:27017/your_database_name
STEAM_API_KEY=your_steam_api_key_here
```
(Note: Ensure `STEAM_API_KEY` is also present if you are working with Steam API features.)

**Benefits of Caching:**
*   **Faster Response Times:** Game data for previously accessed users is served quickly from the cache.
*   **Reduced API Rate Limiting:** Minimizes direct calls to the external Steam API, helping to stay within rate limits.
*   **Lower Server Load:** Decreases processing load on the server by avoiding repeated data fetching and processing.


**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Node.js (for the backend server)
- Express.js (for the backend server)
- MongoDB (for caching Steam game data)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5d71e49f-fe12-4989-b263-cce310d352a6) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
