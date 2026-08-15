import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { Footer } from "./shared/footer";

export default function SignatureReminder({
  senderName,
  senderEmail,
  documentName,
  url,
}: {
  senderName: string;
  senderEmail: string;
  documentName: string;
  url: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Reminder: Please sign {documentName}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">Dossier</span>
            </Text>
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-xl">
              Signature Request Reminder
            </Text>
            <Text className="text-sm leading-6 text-black">
              Hello,
            </Text>
            <Text className="text-sm leading-6 text-black">
              This is a reminder that <span className="font-semibold">{senderName}</span> ({senderEmail})
              is waiting for your signature on the document: <span className="font-semibold">{documentName}</span>.
            </Text>
            <Section className="my-8 text-center">
              <Button
                className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                href={url}
                style={{ padding: "12px 20px" }}
              >
                Review & Sign Document
              </Button>
            </Section>
            <Text className="text-sm leading-6 text-black">
              Or copy and paste this URL into your browser:
            </Text>
            <Text className="max-w-sm flex-wrap break-words font-medium text-purple-600 no-underline">
              {url}
            </Text>
            <Footer footerText="This is a secure signature reminder sent via Dossier." />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
