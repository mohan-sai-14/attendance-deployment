# TU Robotics Club Logo Setup

This guide explains how to set up the TU Robotics Club logo files for the attendance system.

## Required Logo Files

You need to add two logo files to this directory:

1. `robotics-logo.png` - The primary logo (preferred format)
2. `robotics-logo.svg` - The fallback logo (already provided)

## Adding the PNG Logo

1. Save the TU Robotics Club logo image as `robotics-logo.png` in this directory (`app/client/public/`).
2. The logo should be square format, ideally 512x512 pixels or larger.
3. Ensure the image has a transparent background for the best appearance.

## Logo Requirements

The logo should represent the TU Robotics Club with:
- Clear visibility of the "TU Robotics Club" text
- "Takshashila University" branding
- Robot imagery or relevant technological elements

## Testing the Logo

Once you've added the logo file:
1. Start the application
2. Check the login page to verify the logo appears correctly
3. The system will automatically use the SVG fallback if the PNG file is missing or fails to load

## Troubleshooting

If the logo doesn't appear:
- Verify the file is named exactly as `robotics-logo.png`
- Check that it's placed in the correct directory
- Restart the application after adding the files 