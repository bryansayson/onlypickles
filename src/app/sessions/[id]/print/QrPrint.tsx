"use client";

import { QRCodeSVG } from "qrcode.react";

const BASE_URL = "https://onlypicklez.vercel.app";

interface Props {
  sessionId: string;
  sessionName: string | null;
  sessionDate: string;
}

const steps = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0-12l-3 3m3-3l3 3" />
        <rect x="4" y="16" width="16" height="4" rx="1" strokeLinejoin="round" />
      </svg>
    ),
    text: "Tap the Share button in Safari",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="17" y="17" width="3" height="3" rx="0.5" />
      </svg>
    ),
    text: 'Tap "Add to Home Screen"',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    text: 'Tap "Add" — done!',
  },
];

export function QrPrint({ sessionId, sessionName, sessionDate }: Props) {
  const url = `${BASE_URL}/sessions/${sessionId}`;

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-page, .print-page * { visibility: visible; }
          .print-page { position: fixed; top: 0; left: 0; width: 100%; padding: 24pt; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* ── Screen: preview + print button ── */}
      <div className="screen-only min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-zinc-500 text-sm">Print preview</p>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full flex flex-col items-center gap-4">
          <PrintContent sessionName={sessionName} sessionDate={sessionDate} url={url} />
        </div>
        <button
          onClick={() => window.print()}
          className="px-8 py-3 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-colors text-sm"
        >
          Print
        </button>
      </div>

      {/* ── Print output ── */}
      <div className="print-only print-page flex flex-col items-center gap-6">
        <PrintContent sessionName={sessionName} sessionDate={sessionDate} url={url} />
      </div>
    </>
  );
}

function PrintContent({ sessionName, sessionDate, url }: { sessionName: string | null; sessionDate: string; url: string }) {
  return (
    <>
      {/* Heading */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Only Pickles</p>
        <h1 className="text-xl font-bold text-gray-900 leading-tight">
          {sessionName ?? "Pickleball Session"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date(sessionDate).toLocaleDateString(undefined, {
            weekday: "long", month: "long", day: "numeric",
          })}
        </p>
      </div>

      {/* QR code */}
      <div className="border-4 border-gray-900 rounded-xl p-3">
        <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#111111" level="M" />
      </div>

      {/* URL */}
      <p className="text-[10px] text-gray-400 break-all text-center font-mono">{url}</p>

      {/* Divider */}
      <div className="w-full border-t border-gray-200" />

      {/* iOS instructions */}
      <div className="w-full">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-3">
          Add to your iPhone home screen
        </p>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 shrink-0">
                {step.icon}
              </span>
              <span className="text-sm text-gray-700">{step.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
