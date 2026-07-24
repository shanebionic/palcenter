import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { Metadata } from "next";
import { palcenterTheme } from "../theme";

export const metadata: Metadata = {
  title: "PalCenter",
  description: "Remote Palworld Server Manager",
  icons: { icon: "/assets/palcenter.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>

      <body>
        <MantineProvider defaultColorScheme="dark" theme={palcenterTheme}>
          <Notifications />

          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
