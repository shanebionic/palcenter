import { createTheme } from "@mantine/core";

export const palcenterTheme = createTheme({
  primaryColor: "cyan",
  primaryShade: 6,
  defaultRadius: "md",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  headings: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "700",
  },
  colors: {
    cyan: [
      "#e5fbff",
      "#cff4ff",
      "#9ce7ff",
      "#64d8ff",
      "#3acbfe",
      "#20c3fe",
      "#08b8f5",
      "#00a3dc",
      "#008fc5",
      "#007bae",
    ],
  },
  components: {
    Alert: {
      defaultProps: {
        radius: "md",
        variant: "light",
      },
    },
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    FileInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
      },
    },
    NumberInput: {
      defaultProps: {
        radius: "md",
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
      },
    },
    Textarea: {
      defaultProps: {
        radius: "md",
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});
