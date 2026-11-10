import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/components/Button";
import { TelemedicineRequestDialog } from "../../client/components/TelemedicineRequestDialog";

/**
 * Where a visitor who is not signed in starts booking a remote consultation. The booking dialog opens at once: they
 * choose a consultation, a clinic and a time without an account, give their details only then, and pay. When the
 * booking is made they are taken to it. Closing the dialog leaves this page, with a button to open it again.
 */
export const BookTelemedicine = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">Talk to a doctor online</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">
        Choose the consultation you need, pick a time and pay with M-Pesa. You give your details only once you have
        chosen a time.
      </p>
      <div className="mt-8">
        <Button type="button" onClick={() => setOpen(true)}>
          Choose a consultation
        </Button>
      </div>
      <TelemedicineRequestDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(bookingId) => navigate(`/app/bookings/${bookingId}`)}
      />
    </section>
  );
};

export default BookTelemedicine;
