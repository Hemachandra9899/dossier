import { RegisterScreen } from "@/modules/auth";
import { buildMetadata } from "@/shared/config/metadata";
import { productConfig } from "@/shared/config/product";

export const metadata = buildMetadata({
  title: "Sign up",
  description: `Create a ${productConfig.name} workspace`,
  url: productConfig.routes.register,
});

export default function RegisterPage() {
  return <RegisterScreen />;
}
