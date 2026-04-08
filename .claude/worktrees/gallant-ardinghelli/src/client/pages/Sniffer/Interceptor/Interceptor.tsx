import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Interceptor.css";

const Interceptor = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // if (buttonClicked) {
    //   return;
    // }

    setButtonClicked(true);

    if (username === "dani" && password === "123") {
      setIsConnecting(true);
      setError("");
      const lines = [
        "CONNECTING ...",
        "Response from server, exchanging security keys",
        "Verifying credentials....",
        "Waiting for a kiss from the server...",
        "Connected.",
        "ACCESS GRANTED !",
      ];

      let delay = 0;
      for (const line of lines) {
        setTimeout(() => {
          setStatusLines(prevLines => [...prevLines, line]);
        }, delay);
        delay += 1500; // 1.5 seconds delay for each line
      }
      setTimeout(() => {
        navigate("/game/interceptor/messages");
      }, delay);
    } else {
      setError("Incorrect username or password");
    }
  };

  return (
    <div className={` ${isConnecting ? "loginContainer" : "loginContainer blackContainer"}`}>
      <div className="loginWrapper">
        <div className="loginTopTitle">Lorem ipsum, dolor </div>
        <div className="titleUnderline"> </div>

        <div className="authentication">Autentificare </div>
        <div className="warningDiv"> Only Authorized persons </div>
        <div className="credentialsContainer">
          <div>
            <div className="credentialsWrapper">
              <div>
                <input
                  type="text"
                  id="username"
                  value={username}
                  placeholder="username"
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  placeholder="password"
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="error">{error}</div>
            <div className="btnLogin">
              <button
                className="conectBtn"
                onClick={handleSubmit}
                // disabled={buttonClicked}
              >
                {isConnecting ? "......" : "CONNECT"}
              </button>
            </div>

            <div className="statusText">
              {statusLines.map((line, index) => (
                <div key={index} className={line === "ACCESS GRANTED !" ? "accesGranted" : ""}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="warningDiv"> Only Authorized persons. </div>

      <div className="version">Version 3.4.2</div>
    </div>
  );
};

export default Interceptor;
