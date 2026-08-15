import { GTMComponent } from "@/shared/ui/gtm-component";
import { SignInScreen } from "@/features/auth";
import { buildMetadata } from "@/shared/config/metadata";
import { productConfig } from "@/shared/config/product";

export const metadata = buildMetadata({
  title: "Login",
  description: `Sign in to ${productConfig.name}`,
  url: productConfig.routes.login,
});

export default function LoginPage() {
  return (
    <>
      <GTMComponent />
      <SignInScreen />
    </>
  );
}
