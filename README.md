# TU Robotics Club Attendance System

A modern web application for QR code-based attendance management specifically designed for the Takshashila University Robotics Club.

## Features

- **Dual Login System**: Separate interfaces for students and administrators
- **QR Code Attendance**: Generate and scan QR codes for marking attendance
- **Real-time Tracking**: Monitor attendance in real-time
- **Modern UI/UX**: Responsive design with dark/light mode support
- **Glassmorphism Effects**: Modern UI with beautiful glass-like components
- **Animations**: Smooth transitions and animations for better user experience

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (version 16.x or higher)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Safari, or Edge)

## Installation & Setup

Follow these steps carefully to set up and run the application:

### Step 1: Install Root Dependencies

Open your first terminal and run:

```bash
npm install
```

### Step 2: Install App Dependencies

Open a new terminal and navigate to the app directory:

```bash
cd app
npm install
```

### Step 3: Install Client Dependencies

Open another terminal and navigate to the client directory:

```bash
cd app
cd client
npm install
```

### Step 4: Install Server Dependencies

Open another terminal and navigate to the server directory:

```bash
cd app
npm install
```

### Step 5: Start the Application

Now you need to run both the server and client simultaneously. Open **2 new terminals**:

#### Terminal 1 - Start the Server

```bash
cd app
npm run dev
```

The server will start on `http://localhost:3000`

#### Terminal 2 - Start the Client

```bash
cd app
cd client
npm run dev
```

The client will start on `http://localhost:5173`

## Accessing the Application

Once both servers are running:

1. Open your web browser
2. Navigate to `http://localhost:5173`
3. You'll see the login page for the TU Robotics Club Attendance System

## Demo Login Credentials

### Admin Login
- **Username**: `admin`
- **Password**: `admin123`

### Student Login
- **Username**: `S1001`
- **Password**: `student123`

## How to Use

### For Administrators:
1. Login with admin credentials
2. Navigate to "QR Generator" to create attendance sessions
3. Generate QR codes for students to scan
4. Monitor real-time attendance in the "Attendance" section
5. Manage students in the "Students" section
6. Generate reports in the "Reports" section

### For Students:
1. Login with student credentials
2. View active sessions on the dashboard
3. Use "Scan QR" to mark attendance by scanning the QR code
4. Check attendance history in "My Attendance"

## Project Structure

```
├── app/                          # Main application directory
│   ├── client/                   # Frontend React application
│   │   ├── src/
│   │   │   ├── components/       # Reusable UI components
│   │   │   ├── pages/           # Page components
│   │   │   ├── lib/             # Utilities and helpers
│   │   │   └── hooks/           # Custom React hooks
│   │   └── public/              # Static assets
│   ├── server/                   # Backend Express server
│   │   └── src/                 # Server source code
│   └── shared/                   # Shared types and utilities
├── client/                       # Alternative client setup
└── server/                       # Alternative server setup
```

## Tech Stack

- **Frontend**: React with TypeScript, Vite
- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Custom components with Radix UI
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **QR Code**: QRCode.react and HTML5-QRCode
- **State Management**: React Query + Zustand

## Database Setup

The application uses Supabase as the database. The connection is already configured in the code. If you need to set up your own database:

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Update the Supabase credentials in the configuration files
4. Run the SQL migrations found in `server/db/` directory

## Troubleshooting

### Common Issues:

1. **Port conflicts**: If ports 3000 or 5173 are in use, the applications will automatically try alternative ports
2. **Database connection**: Ensure Supabase credentials are correctly configured
3. **Camera permissions**: For QR scanning, ensure your browser has camera permissions enabled

### If you encounter errors:

1. Make sure all dependencies are installed in each directory
2. Check that both server and client are running
3. Verify your browser supports camera access for QR scanning
4. Check the browser console for any JavaScript errors

## Deployment

This application can be deployed to production using Netlify (frontend) and Render (backend).

### Step 1: Deploy Frontend to Netlify

1. **Create a Netlify account** at [netlify.com](https://netlify.com) if you don't have one

2. **Connect your repository**:
   - Log in to Netlify
   - Click "New site from Git"
   - Connect your GitHub/GitLab repository
   - Select your repository

3. **Configure build settings**:
   - **Base directory**: `app/client` (leave empty if Netlify doesn't ask)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

4. **Set environment variables** in Netlify dashboard:
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://your-app.onrender.com`)

5. **Deploy**: Click "Deploy site"

### Step 2: Deploy Backend to Render

1. **Create a Render account** at [render.com](https://render.com) if you don't have one

2. **Create a new Web Service**:
   - Connect your repository
   - **Name**: `attendance-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `cd app && npm install && npm run build:server`
   - **Start Command**: `cd app && npm run start`

3. **Configure environment variables** in Render dashboard:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Your database connection string
   - `SESSION_SECRET`: Generate a secure random string
   - `FRONTEND_URL`: Your Netlify site URL (e.g., `https://tuattendance.netlify.app`)
   - `COOKIE_DOMAIN`: Your Netlify site domain (e.g., `tuattendance.netlify.app`)

4. **Deploy**: Click "Create Web Service"

### Step 3: Update Configuration Files

1. **Update server CORS settings** in `app/server/index.ts`:
   ```typescript
   const allowedOrigins = [
     'https://tuattendance.netlify.app', // Your Netlify domain
     process.env.FRONTEND_URL,
     // ... other origins
   ];
   ```

2. **Update netlify.toml** with your Render backend URL:
   ```toml
   VITE_API_URL = "https://your-render-app.onrender.com"
   ```

3. **Update render.yaml** with your Netlify domain:
   ```yaml
   FRONTEND_URL = "https://tuattendance.netlify.app"
   ```

### Step 4: Database Setup

1. **Set up your database** (if not using the existing setup):
   - Create a PostgreSQL database
   - Run the migrations from `app/server/migrations/`
   - Update `DATABASE_URL` in Render environment variables

2. **Test the deployment**:
   - Visit your Netlify site
   - Verify API calls work correctly
   - Test both admin and student login flows

### Important Notes

- **Environment Variables**: Make sure all required environment variables are set in both Netlify and Render
- **CORS**: The backend is configured to accept requests from your Netlify domain
- **Database**: Ensure your database allows connections from Render's IP addresses
- **HTTPS**: Both Netlify and Render provide HTTPS by default

### Troubleshooting Deployment

1. **Build fails**: Check the build logs in Netlify/Render dashboard
2. **API not working**: Verify the `VITE_API_URL` environment variable
3. **CORS errors**: Check that your domain is in the allowed origins list
4. **Database connection**: Verify the `DATABASE_URL` format and credentials

## Development

### Adding New Features

1. Frontend components go in `app/client/src/components/`
2. New pages go in `app/client/src/pages/`
3. Backend routes go in `app/server/src/routes.ts`
4. Database schemas are in `shared/schema.ts`

### Building for Production

```bash
cd app
npm run build
```

## Logo Setup

For proper branding, you need to set up the TU Robotics Club logo:

1. Add the following files to the `app/client/public/` directory:
   - `robotics-logo.png` - Primary logo image
   - `robotics-logo.svg` - SVG fallback (already provided)

2. For detailed instructions, see the [logo setup guide](app/client/public/logo-instructions.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Ensure all installation steps were followed correctly
3. Verify that all required dependencies are installed
4. Check that both server and client terminals are running without errors

## License

This project is licensed under the MIT License.

---

**Note**: This application is designed for educational purposes for the Takshashila University Robotics Club. Make sure to follow your institution's guidelines for attendance tracking and data privacy.
