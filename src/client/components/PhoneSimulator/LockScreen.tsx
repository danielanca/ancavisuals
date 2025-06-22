// import { Link } from 'react-router-dom'
// import '../Styles/Main.css'
// import wifi from "../Images/Icons/wifi.png"
// import battery from "../Images/Icons/battery.png"
// import lock from "../Images/Icons/lock.png"
// import torch from "../Images/Icons/torch.png"
// import camera from "../Images/Icons/camera.png"

// function LockScreen() {
//   return (
//     <>
//     		<div>
// 			<h1 id="title">iPhone 12</h1>
// 			<p id="sub">Recreated in HTML, CSS, JS</p>
// 		</div>

// 		<div className="main">
// 			<div className="side left">
// 				<div className="dash left top"></div>

// 				<div className="audio">
// 					<div className="side ringer"></div>
// 					<div className="side volume up"></div>
// 					<div className="side volume down"></div>
// 				</div>

// 				<div className="dash left bottom"></div>
// 			</div>

// 			<div className="iphone" id="iphone">
// 				<div className="dash top"></div>

// 				<div className="inner" id="inner">
// 					<div className="top">
// 						<div className="left">
// 							{/* <p>Spectrum</p> */}
// 						</div>
// 						<div className="center" id="center">
// 							<div className="mic" id="mic">
// 							</div>

// 							<div className="cam">
// 							</div>
// 						</div>

// 						<div className="right">
// 							<div className="container">
// 								<ion-icon name="cellular" className="cellular"></ion-icon>

// 								<img src={wifi} alt='wifi' className="wifi" />

// 								<img src={battery} alt='battery' className="battery" />
// 							</div>

// 							{/* <div className="line"></div> */}
// 						</div>
// 					</div>

// 					<div className="content" id="content">
// 						<img src={lock} alt='lock' className="lock" />

// 						<h1 className="time">9:41</h1>

// 						<h1 className="date">Tuesday, January 9</h1>
// 					</div>

// 					<div className="buttons" id="bottom">
// 						<button className="torch" id="torchBtn" onclick="changeColorTorch()">
// 							<img src={torch} alt='torch' id="torchImg" />
// 						</button>

// 						<Link to={"/main"}>
// 							<button className="camera" id="cameraBtn">
// 								<img src={camera} alt='camera' id="cameraImg" />
// 							</button>
// 						</Link>
// 					</div>

// 					<p className="swipe" id="swipe">Touch bar to unlock</p>

// 					<Link to={"/mobilepasscode"}>
// 						<div className="home"></div>
// 					</Link>

// 					<div className="dash bottom"></div>
// 				</div>
// 			</div>

// 			<div className="side right">
// 				<div className="dash right top"></div>

// 				<div className="side power" onclick="turnOff()"></div>

// 				<div className="dash right bottom"></div>
// 			</div>
// 		</div>

//     </>
//   );
// }

// export default LockScreen;

// import { useState, useRef } from 'react'
// import { Link, useNavigate } from 'react-router-dom'
// import "./styles.css"
// import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png"
// import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png"
// import lock from "../../media/assets/phone-simulator/Images/Icons/lock.png"
// import torch from "../../media/assets/phone-simulator/Images/Icons/torch.png"
// import camera from "../../media/assets/phone-simulator/Images/Icons/camera.png"

// const LockScreen: React.FC = () => {

//   return (
//     <>
// 		{/* <div>
// 			<h1 id="title">iPhone 12</h1>
// 			<p id="sub">Recreated in HTML, CSS, JS</p>
// 		</div> */}

// 		<div className="main">
// 			<div className="side left">
// 				<div className="dash left top"></div>

// 				<div className="audio">
// 					<div className="side ringer"></div>
// 					<div className="side volume up"></div>
// 					<div className="side volume down"></div>
// 				</div>

// 				<div className="dash left bottom"></div>
// 			</div>

// 			<div className="iphone" id="iphone">
// 				<div className="dash top"></div>

// 				<div className="inner" id="inner">
// 					<div className="top">
// 						<div className="left">
// 							{/* <p>Spectrum</p> */}
// 						</div>
// 						<div className="center" id="center">
// 							<div className="mic" id="mic">
// 							</div>

// 							<div className="cam">
// 							</div>
// 						</div>

// 						<div className="right">
// 							<div className="container">
// 								{/* <ion-icon name="cellular" className="cellular"></ion-icon> */}

// 								<img src={wifi} alt='wifi' className="wifi" />

// 								<img src={battery} alt='battery' className="battery" />
// 							</div>

// 							{/* <div className="line"></div> */}
// 						</div>
// 					</div>

// 					<div className="content" id="content">
// 						<img src={lock} alt='lock' className="lock" />

// 						<h1 className="time">9:41</h1>

// 						<h1 className="date">Tuesday, January 9</h1>
// 					</div>

// 					<div className="buttons" id="bottom">
// 						<button className="torch" id="torchBtn">
// 							<img src={torch} alt='torch' id="torchImg" />
// 						</button>

// 						<Link to={"/phone/lock-screen"}>
// 							<button className="camera" id="cameraBtn">
// 								<img src={camera} alt='camera' id="cameraImg" />
// 							</button>
// 						</Link>
// 					</div>

// 					<p className="swipe" id="swipe">Touch bar to unlock</p>
// 					<Link to={"/phone/passcode"}>
// 						<div className="home"></div>
// 					</Link>

// 					<div className="dash bottom"></div>
// 				</div>
// 			</div>

// 			<div className="side right">
// 				<div className="dash right top"></div>

// 				<div className="side power"></div>

// 				<div className="dash right bottom"></div>
// 			</div>
// 		</div>

//     </>
//   );
// }

// export default LockScreen;

import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./styles.css";
import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png";
import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png";
import lock from "../../media/assets/phone-simulator/Images/Icons/lock.png";
import torch from "../../media/assets/phone-simulator/Images/Icons/torch.png";
import camera from "../../media/assets/phone-simulator/Images/Icons/camera.png";

const LockScreen: React.FC = () => {
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const navigate = useNavigate();
  const iphoneRef = useRef<HTMLDivElement>(null);

  const togglePower = () => {
    setIsPoweredOn(!isPoweredOn); // Toggle power state
  };

  // Optional: Apply styles directly in CSS for better separation of concerns
  const screenStyle = {
    opacity: isPoweredOn ? "1" : "0", // Control opacity to simulate screen on/off
    transition: "opacity 0.5s ease", // Smooth transition for turning on/off
  };

  return (
    <>
      <div className="main">
        <div className="side left">
          <div className="dash left top"></div>
          <div className="audio">
            <div className="side ringer"></div>
            <div className="side volume up"></div>
            <div className="side volume down"></div>
          </div>
          <div className="dash left bottom"></div>
        </div>

        <div className="iphone" ref={iphoneRef} style={{ opacity: isPoweredOn ? "1" : "0.1" }}>
          <div className="dash top"></div>
          <div className="inner" style={screenStyle}>
            <div className="top">
              <div className="left"></div>
              <div className="center" id="center">
                <div className="mic" id="mic"></div>
                <div className="cam"></div>
              </div>
              <div className="right">
                <div className="container">
                  <img src={wifi} alt="wifi" className="wifi" />
                  <img src={battery} alt="battery" className="battery" />
                </div>
              </div>
            </div>
            <div className="content" id="content">
              <img src={lock} alt="lock" className="lock" />
              <h1 className="time">9:41</h1>
              <h1 className="date">Tuesday, January 9</h1>
            </div>
            <div className="buttons" id="bottom">
              <button className="torch" id="torchBtn">
                <img src={torch} alt="torch" id="torchImg" />
              </button>
              <Link to={"/phone/lock-screen"}>
                <button className="camera" id="cameraBtn">
                  <img src={camera} alt="camera" id="cameraImg" />
                </button>
              </Link>
            </div>
            <p className="swipe" id="swipe">
              Touch bar to unlock
            </p>
            <Link to={"/phone/passcode"}>
              <div className="home"></div>
            </Link>
            <div className="dash bottom"></div>
          </div>
        </div>

        <div className="side right">
          <div className="dash right top"></div>
          <div className="side power" onClick={togglePower}></div>
          <div className="dash right bottom"></div>
        </div>
      </div>
    </>
  );
};

export default LockScreen;
