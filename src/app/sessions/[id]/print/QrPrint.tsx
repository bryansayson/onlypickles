"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

const BASE_URL = "https://onlypicklez.vercel.app";

interface Props {
  sessionId: string;
  sessionName: string | null;
  sessionDate: string;
}

export function QrPrint({ sessionId, sessionName, sessionDate }: Props) {
  const url = `${BASE_URL}/sessions/${sessionId}`;

  useEffect(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8 print:p-0">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Only Pickles</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {sessionName ?? "Pickleball Session"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(sessionDate).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* QR code */}
        <div className="p-4 border-4 border-gray-900 rounded-xl">
          <QRCodeSVG
            value={url}
            size={220}
            bgColor="#ffffff"
            fgColor="#111111"
            level="M"
          />
        </div>

        {/* URL */}
        <p className="text-xs text-gray-400 break-all text-center font-mono">{url}</p>

        {/* Print button — hidden when printing */}
        <button
          onClick={() => window.print()}
          className="print:hidden mt-2 px-6 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          Print
        </button>
      </div>
    </div>
  );
}
