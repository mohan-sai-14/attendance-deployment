import { createBrowserRouter } from "react-router-dom";
import FacultyLayout from "@/pages/faculty/Layout";
import FacultyDashboard from "@/pages/faculty/Dashboard";

export const facultyRoutes = createBrowserRouter([
  {
    path: "/faculty",
    element: <FacultyLayout />,
    children: [
      {
        index: true,
        element: <FacultyDashboard />,
      },
      // Add more faculty routes here as needed
      // {
      //   path: "sessions",
      //   element: <SessionsPage />,
      // },
      // {
      //   path: "students",
      //   element: <StudentsPage />,
      // },
      // {
      //   path: "reports",
      //   element: <ReportsPage />,
      // },
    ],
  },
]);
