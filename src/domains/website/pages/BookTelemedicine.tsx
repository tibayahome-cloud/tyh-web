import { useNavigate } from "react-router-dom";

import { TelemedicineRequestDialog } from "../../client/components/TelemedicineRequestDialog";

/**
 * Where a visitor who is not signed in books a remote consultation. The booking is the page itself, not a popup over it:
 * there is nothing underneath to go back to, and a five-step task with a long catalogue, a sign-up and a payment needs the
 * room, the scrolling and the address of a page. They choose a consultation, a clinic and a time without an account, give
 * their details only then, and pay. When the booking is made they are taken to it.
 */
export const BookTelemedicine = () => {
  const navigate = useNavigate();

  return (
    // The same container as the site header, so the page lines up with the logo and the phone number above it. The header
    // is fixed, so the first step starts below it.
    <section className="container mx-auto px-4 pb-16 pt-4 sm:pt-8 md:px-6">
      <TelemedicineRequestDialog
        layout="page"
        open
        onClose={() => navigate("/")}
        onCreated={(bookingId) => navigate(`/app/bookings/${bookingId}`)}
      />
    </section>
  );
};

export default BookTelemedicine;
