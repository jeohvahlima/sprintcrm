const Tarefas = () => {
  return (
    <div className="h-full w-full min-h-screen bg-background flex flex-col">
      <iframe
        src="/tarefas.html"
        title="Tarefas"
        style={{
          width: "100%",
          minHeight: "calc(100vh - 80px)",
          border: 0,
          background: "#0b0e14",
        }}
      />
    </div>
  );
};

export default Tarefas;
