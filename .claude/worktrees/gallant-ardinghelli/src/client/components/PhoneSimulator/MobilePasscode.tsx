// import React from 'react'
// import { Link } from 'react-router-dom'
// import "../Styles/Main.css"
// import "../Styles/Pascode.css"
// import wifi from "../Images/Icons/wifi.png"
// import battery from "../Images/Icons/battery.png"
// import lock from "../Images/Icons/lock.png"

// function MobilePasscode() {
//   return (
//     <>
// 		<div>
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

// 			<div className="iphone passcode" id="iphone">
// 				<div className="dash top"></div>

// 				<div className="inner passcode" id="inner">
// 					<div className="top">
// 						<div className="left"></div>

// 						<div className="center" id="center">
// 							<div className="mic" id="mic">
// 							</div>

// 							<div className="cam">
// 							</div>
// 						</div>

// 						<div className="right">
// 							<ion-icon name="cellular" className="cellular"></ion-icon>

// 							<img src={wifi} alt='wifi' className="wifi" />

// 							<img src={battery} alt='battery' className="battery" />
// 						</div>
// 					</div>

// 					<div className="content">
// 						<img src={lock} alt='lock' className="lock" />

// 						<div className="passcode">
// 							<h3>Enter Passcode</h3>

// 							<div className="dots">
// 								<div className="dot" id="dot1"></div>

// 								<div className="dot" id="dot2"></div>

// 								<div className="dot" id="dot3"></div>

// 								<div className="dot" id="dot4"></div>

// 								<div className="dot" id="dot5"></div>

// 								<div className="dot" id="dot6"></div>
// 							</div>

// 							<div className="keypad">
// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num alone">1</div>
// 									<div className="letters"></div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">2</div>
// 									<div className="letters">ABC</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">3</div>
// 									<div className="letters">DEF</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">4</div>
// 									<div className="letters">GHI</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">5</div>
// 									<div className="letters">JKL</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">6</div>
// 									<div className="letters">MNO</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">7</div>
// 									<div className="letters">PQRS</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">8</div>
// 									<div className="letters">TUV</div>
// 								</button>

// 								<button className="key" onclick="addFilledDot()">
// 									<div className="num">9</div>
// 									<div className="letters">WXYZ</div>
// 								</button>

// 								<button className="key zero" onclick="addFilledDot()">
// 									<div className="num">0</div>
// 									<div className="letters"></div>
// 								</button>
// 							</div>
// 						</div>

// 						<div className="bottom">
// 							<p>Emergency</p>

// 							<Link to="/main">
// 								<p>Cancel</p>
// 							</Link>
// 						</div>
// 					</div>

// 					<div className="dash bottom"></div>
// 				</div>
// 			</div>

// 			<div className="side right">
// 				<div className="dash right top"></div>

// 				<div className="side power" onclick="turnOffLock()"></div>

// 				<div className="dash right bottom"></div>
// 			</div>
// 		</div>
//     </>
//   )
// }

// export default MobilePasscode;

// import React, { useState, useEffect } from 'react'
// import { Link } from 'react-router-dom'
// import "../Styles/Main.css"
// import "../Styles/Pascode.css"
// import wifi from "../Images/Icons/wifi.png"
// import battery from "../Images/Icons/battery.png"
// import lock from "../Images/Icons/lock.png"

// function MobilePasscode() {

// // 	var passcodeCount = 0;

// // function addFilledDot() {
// // 	passcodeCount++;

// // 	document.getElementById("dot" + passcodeCount).style.backgroundColor = "#fff";

// // 	if (passcodeCount == 6) {
// // 		setTimeout(function(){
// // 			window.location.href = "/home.html";

// // 			var all = document.getElementsByClassName("dot");
// // 			for (var i = 0; i < all.length; i++) {
// // 				all[i].style.backgroundColor = "transparent";
// // 			}
// // 		}, 500);
// // 	}
// // }

// const [passcodeCount, setPasscodeCount] = useState(0);

// useEffect(() => {
//   if (passcodeCount === 6) {
// 	setTimeout(() => {
// 	  window.location.href = "/home.html";
// 	  setPasscodeCount(0); // Resets passcode count after redirect
// 	}, 500);
//   }
// }, [passcodeCount]);

// const addFilledDot = () => {
//   setPasscodeCount(prevCount => prevCount < 6 ? prevCount + 1 : prevCount);
// };

//   return (
//     <>
// 		<div>
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

// 			<div className="iphone passcode" id="iphone">
// 				<div className="dash top"></div>

// 				<div className="inner passcode" id="inner">
// 					<div className="top">
// 						<div className="left"></div>

// 						<div className="center" id="center">
// 							<div className="mic" id="mic">
// 							</div>

// 							<div className="cam">
// 							</div>
// 						</div>

// 						<div className="right">
// 							<ion-icon name="cellular" className="cellular"></ion-icon>

// 							<img src={wifi} alt='wifi' className="wifi" />

// 							<img src={battery} alt='battery' className="battery" />
// 						</div>
// 					</div>

// 					<div className="content">
// 						<img src={lock} alt='lock' className="lock" />

// 						<div className="passcode">
// 							<h3>Enter Passcode</h3>

// 							<div className="dots">
// 								<div className="dot" id="dot1"></div>

// 								<div className="dot" id="dot2"></div>

// 								<div className="dot" id="dot3"></div>

// 								<div className="dot" id="dot4"></div>

// 								<div className="dot" id="dot5"></div>

// 								<div className="dot" id="dot6"></div>
// 							</div>

// 							<div className="keypad">
// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num alone">1</div>
// 									<div className="letters"></div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">2</div>
// 									<div className="letters">ABC</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">3</div>
// 									<div className="letters">DEF</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">4</div>
// 									<div className="letters">GHI</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">5</div>
// 									<div className="letters">JKL</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">6</div>
// 									<div className="letters">MNO</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">7</div>
// 									<div className="letters">PQRS</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">8</div>
// 									<div className="letters">TUV</div>
// 								</button>

// 								<button className="key" onClick={addFilledDot()}>
// 									<div className="num">9</div>
// 									<div className="letters">WXYZ</div>
// 								</button>

// 								<button className="key zero" onClick={addFilledDot()}>
// 									<div className="num">0</div>
// 									<div className="letters"></div>
// 								</button>
// 							</div>
// 						</div>

// 						<div className="bottom">
// 							<p>Emergency</p>

// 							<Link to="/main">
// 								<p>Cancel</p>
// 							</Link>
// 						</div>
// 					</div>

// 					<div className="dash bottom"></div>
// 				</div>
// 			</div>

// 			<div className="side right">
// 				<div className="dash right top"></div>

// 				<div className="side power" onclick="turnOffLock()"></div>

// 				<div className="dash right bottom"></div>
// 			</div>
// 		</div>
//     </>
//   )
// }

// export default MobilePasscode;

// import React, { useState, useEffect } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import "./styles.css"
// import "./Pascode.css"
// import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png"
// import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png";
// import lock from "../../media/assets/phone-simulator/Images/Icons/lock.png";

// const MobilePasscode: React.FC = () => {
//   const [passcodeCount, setPasscodeCount] = useState(0);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (passcodeCount === 6) {
//       setTimeout(() => {
//         // window.location.href = "/phone/home";
//         navigate('/phone/home');
//         setPasscodeCount(0);
//       }, 500);
//     }
//   }, [passcodeCount]);

//   const addFilledDot = () => {
//     setPasscodeCount(prevCount => prevCount < 6 ? prevCount + 1 : prevCount);
//   };

//   return (
//     <>
//       {/* <div>
//         <h1 id="title">iPhone 12</h1>
//         <p id="sub">Recreated in HTML, CSS, JS</p>
//       </div> */}

//       <div className="main">
//         <div className="side left">
//           <div className="dash left top"></div>
//           <div className="audio">
//             <div className="side ringer"></div>
//             <div className="side volume up"></div>
//             <div className="side volume down"></div>
//           </div>
//           <div className="dash left bottom"></div>
//         </div>

//         <div className="iphone passcode" id="iphone">
//           <div className="dash top"></div>
//           <div className="inner passcode" id="inner">
//             <div className="top">
//               <div className="left"></div>
//               <div className="center" id="center">
//                 <div className="mic" id="mic"></div>
//                 <div className="cam"></div>
//               </div>
//               <div className="right">
//                 {/* <ion-icon name="cellular" className="cellular"></ion-icon> */}
//                 <img src={wifi} alt='wifi' className="wifi" />
//                 <img src={battery} alt='battery' className="battery" />
//               </div>
//             </div>
//             <div className="content">
//               <img src={lock} alt='lock' className="lock" />
//               <div className="passcode">
//                 <h3>Enter Passcode</h3>
//                 <div className="dots">
//                   {[...Array(6)].map((_, index) => (
//                     <div key={index} className="dot" style={{ backgroundColor: index < passcodeCount ? '#fff' : 'transparent' }}></div>
//                   ))}
//                 </div>
//                 <div className="keypad">
//                   {['1', '2ABC', '3DEF', '4GHI', '5JKL', '6MNO', '7PQRS', '8TUV', '9WXYZ', '0'].map((item, index) => (
//                     <button key={index} className={`key ${item === '0' ? 'zero' : ''}`} onClick={addFilledDot}>
//                       <div className="num">{item[0]}</div>
//                       <div className="letters">{item.slice(1)}</div>
//                     </button>
//                   ))}
//                 </div>
//               </div>
//               <div className="bottom">
//                 <p>Emergency</p>
//                 <Link to="/phone/lock-screen">
//                   <p>Cancel</p>
//                 </Link>
//               </div>
//             </div>
//             <div className="dash bottom"></div>
//           </div>
//         </div>

//         <div className="side right">
//           <div className="dash right top"></div>
//           <div className="side power" onClick={() => alert("Power button clicked")}></div>
//           <div className="dash right bottom"></div>
//         </div>
//       </div>
//     </>
//   );
// }

// export default MobilePasscode;

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./styles.css";
import "./Pascode.css";
import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png";
import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png";
import lock from "../../media/assets/phone-simulator/Images/Icons/lock.png";

const MobilePasscode: React.FC = () => {
  const [passcodeCount, setPasscodeCount] = useState(0);
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (passcodeCount === 6) {
      setTimeout(() => {
        navigate("/phone/home");
        setPasscodeCount(0);
      }, 500);
    }
  }, [passcodeCount, navigate]);

  const addFilledDot = () => {
    if (isPoweredOn) {
      setPasscodeCount(prevCount => (prevCount < 6 ? prevCount + 1 : prevCount));
    }
  };

  const togglePower = () => {
    setIsPoweredOn(!isPoweredOn);
  };

  // Style for the entire phone, including screen on/off effects
  const phoneStyle = {
    opacity: isPoweredOn ? "1" : "0", // Control opacity to simulate screen on/off
    backgroundColor: isPoweredOn ? "" : "black", // Set background color to black when off
    backgroundImage: isPoweredOn ? "" : "none", // Remove any background image when off
    transition: "all 0.5s ease", // Smooth transition for changes
  } as React.CSSProperties; // Type assertion for TypeScript

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

        <div className="iphone passcode" id="iphone" style={phoneStyle}>
          <div className="dash top"></div>
          <div className="inner passcode" id="inner">
            <div className="top">
              <div className="left"></div>
              <div className="center" id="center">
                <div className="mic" id="mic"></div>
                <div className="cam"></div>
              </div>
              <div className="right">
                <img src={wifi} alt="wifi" className="wifi" />
                <img src={battery} alt="battery" className="battery" />
              </div>
            </div>
            <div className="content">
              <img src={lock} alt="lock" className="lock" />
              <div className="passcode">
                <h3>Enter Passcode</h3>
                <div className="dots">
                  {[...Array(6)].map((_, index) => (
                    <div
                      key={index}
                      className="dot"
                      style={{ backgroundColor: index < passcodeCount ? "#fff" : "transparent" }}
                    ></div>
                  ))}
                </div>
                <div className="keypad">
                  {["1", "2ABC", "3DEF", "4GHI", "5JKL", "6MNO", "7PQRS", "8TUV", "9WXYZ", "0"].map((item, index) => (
                    <button key={index} className={`key ${item === "0" ? "zero" : ""}`} onClick={addFilledDot}>
                      <div className="num">{item[0]}</div>
                      <div className="letters">{item.slice(1)}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bottom">
                <p>Emergency</p>
                <Link to="/phone/lock-screen">
                  <p>Cancel</p>
                </Link>
              </div>
            </div>
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

export default MobilePasscode;
