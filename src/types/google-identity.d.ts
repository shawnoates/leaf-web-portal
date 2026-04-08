declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by: string;
  }

  interface GsiButtonConfiguration {
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    width?: number;
    logo_alignment?: "left" | "center";
  }

  function initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
  }): void;

  function renderButton(
    parent: HTMLElement,
    options: GsiButtonConfiguration
  ): void;

  function prompt(): void;
}
