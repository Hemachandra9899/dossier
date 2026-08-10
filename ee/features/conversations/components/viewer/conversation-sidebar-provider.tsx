import React, { createContext, useContext, useState } from "react";

const ConversationSidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
  toggleOpen: () => {},
});

export function ConversationSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleOpen = () => setIsOpen((prev) => !prev);
  return (
    <ConversationSidebarContext.Provider
      value={{ isOpen, setIsOpen, toggleOpen }}
    >
      {children}
    </ConversationSidebarContext.Provider>
  );
}

export function ConversationSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export function useConversationSidebarSafe() {
  return useContext(ConversationSidebarContext);
}
