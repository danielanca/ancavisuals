import React from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Hero from "./Hero";
import Featured from "./Featured";
import Philosophy from "./Philosophy";
import Approach from "./Approach";
import CTAPreview from "./CTAPreview/CTAPreview";
import FAQPage from "../Faq/FAQPage";
import VideoPreview from "../Videos/VideoPreview";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <Hero />
      <CTAPreview />
      <Featured />
      <VideoPreview
        src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FBucurestiNunta.mp4?alt=media&token=74d6a5b5-0906-45e1-950c-9632bba7889b"
        poster=""
      />
      <VideoPreview
        src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FVideo_Daniel_Ana_instagram.mp4?alt=media&token=e9ca7716-f49b-4dfa-aa11-39fc3bd20cf3"
        poster="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FVideo_Daniel_Ana_instagram.mp4.jpg?alt=media&token=359882e0-7e12-4925-bb31-bcb5978fa59a"
      />
      <VideoPreview
        src="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FClaudiu%20Scurt.mp4?alt=media&token=c79e0f29-501f-4efb-be3a-73f52b3d2e38"
        poster="https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FClaudiu%20Scurt.jpg?alt=media&token=02cc0535-5268-43fb-8a6c-63ede75b2c6f"
      />
      <Philosophy />
      <Approach />
      <FAQPage />
      <Footer />
    </div>
  );
};

export default HomePage;
