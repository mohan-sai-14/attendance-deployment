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
