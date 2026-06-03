import React from "react";

const CallCenterPreview = () => {
  return (
    <div className="h-full w-full min-h-screen bg-background flex flex-col">
      <iframe
        title="Call Center Preview"
        src="/call-center.html"
        style={{
          width: "100%",
          minHeight: "calc(100vh - 80px)",
          height: "100%",
          border: "0",
          background: "#0a0c0f",
        }}
      />
    </div>
  );
};

export default CallCenterPreview;
