import React from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import CompanyDocumentsTab from "./CompanyDocumentsTab";

export default function CompanyDocumentsPage() {
  const { auth } = useAuth();

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <p className="mb-1 text-xs uppercase tracking-widest text-neutral-500">Administrare</p>
          <h1 className="text-2xl font-bold text-white">Documente firmă</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Arhiva digitală pentru toate actele de care ai nevoie la bancă, la contabilitate sau la un control.
          </p>
        </div>
        <CompanyDocumentsTab accessToken={auth.accessToken ?? ""} />
      </div>
    </main>
  );
}
