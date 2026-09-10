import { Download, Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";

export default function CanteenQRCode({ canteen }) {
  const canvasRef = useRef(null);
  if (!canteen) return null;
  const url = `${window.location.origin}/canteen/${canteen.id || canteen._id}`;
  const download = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `canteen-${canteen.id || canteen._id}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const print = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const win = window.open("", "_blank", "width=500,height=600");
    if (!win) return;
    win.document.write(`<title>${canteen.name} QR</title><body style="font-family:Arial;text-align:center;padding:30px"><h1>${canteen.name}</h1><img src="${canvas.toDataURL("image/png")}" /><p>${url}</p><script>window.onload=()=>window.print()</script></body>`);
    win.document.close();
  };
  return <div className="qr-panel"><p className="admin-kicker">Customer Ordering QR</p><h3 className="mt-1 text-lg font-black text-slate-950">{canteen.name}</h3><div ref={canvasRef} className="mt-5 inline-block rounded-xl bg-white p-3 shadow-sm"><QRCodeCanvas value={url} size={180} includeMargin /></div><p className="mt-4 break-all text-xs text-slate-500">{url}</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={download} className="button-primary"><Download size={14} /> Download</button><button type="button" onClick={print} className="button-secondary"><Printer size={14} /> Print</button></div></div>;
}
