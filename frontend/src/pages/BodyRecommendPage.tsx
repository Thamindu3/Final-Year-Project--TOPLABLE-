// frontend/src/pages/BodyRecommendPage.tsx
import React from "react";
import BodyProfileForm from "../components/BodyProfileForm";
import Navbar from "../components/Navbar";

const BodyRecommendPage: React.FC = () => {
  return (
    <div>
      <Navbar />
      <BodyProfileForm />
    </div>
  );
};

export default BodyRecommendPage;
