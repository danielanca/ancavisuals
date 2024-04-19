// import React from 'react'
// import { Link } from 'react-router-dom'
// import "./styles.css"
// import "./MainHome.css"
// import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png"
// import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png"
// import videoCall from "../../media/assets/phone-simulator/Images/Apps/videoCall.png"
// import date from "../../media/assets/phone-simulator/Images/Apps/date.png"
// import flower from "../../media/assets/phone-simulator/Images/Apps/flower.png"
// import camera from "../../media/assets/phone-simulator/Images/Apps/camera.png"
// import mail from "../../media/assets/phone-simulator/Images/Apps/mail.png"
// import clock from "../../media/assets/phone-simulator/Images/Apps/clock.png"
// import map from "../../media/assets/phone-simulator/Images/Apps/map.png"
// import weather from "../../media/assets/phone-simulator/Images/Apps/weather.png"
// import marks from "../../media/assets/phone-simulator/Images/Apps/marks.png"
// import notes from "../../media/assets/phone-simulator/Images/Apps/notes.png"
// import heartbeat from "../../media/assets/phone-simulator/Images/Apps/heartbeat.png"
// import zigzag from "../../media/assets/phone-simulator/Images/Apps/zigzag.png"
// import books from "../../media/assets/phone-simulator/Images/Apps/books.png"
// import AppStore from "../../media/assets/phone-simulator/Images/Apps/AppStore.png"
// import Podcasts from "../../media/assets/phone-simulator/Images/Apps/Podcasts.png"
// import tv from "../../media/assets/phone-simulator/Images/Apps/tv.png"
// import health from "../../media/assets/phone-simulator/Images/Apps/health.png"
// import Home from "../../media/assets/phone-simulator/Images/Apps/Home.png"
// import Wallet from "../../media/assets/phone-simulator/Images/Apps/Wallet.png"
// import Settings from "../../media/assets/phone-simulator/Images/Apps/Settings.png"
// import phone from "../../media/assets/phone-simulator/Images/Apps/phone.png"
// import safari from "../../media/assets/phone-simulator/Images/Apps/safari.png"
// import iMessage from "../../media/assets/phone-simulator/Images/Apps/iMessage.png"
// import music from "../../media/assets/phone-simulator/Images/Apps/music.png"

// const MobileHome: React.FC = () => {
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
      
// 			<div className="iphone home" id="iphone">
// 				<div className="dash top"></div>

// 				<div className="inner" id="inner">
// 					<div className="top">
// 						<div className="left">
// 							<p className="time">9:41</p>
// 						</div>
// 						<div className="center">	
// 							<div className="mic">
// 							</div>

// 							<div className="cam">
// 							</div>
// 						</div>

// 						<div className="right">
// 							{/* <ion-icon name="cellular" className="cellular"></ion-icon> */}

// 							<img src={wifi} alt='wifi' className="wifi" />

// 							<img src={battery} alt='battery' className="battery" />
// 						</div>
// 					</div>


// 					<div className="content">
// 						<div className="icons">
// 							<div className="appContainer">
// 								<img src={videoCall} alt='videoCall' className="app" />

// 								<p>FaceTime</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={date} alt='date' className="app" />

// 								<p>Calendar</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={flower} alt='flower' className="app" />

// 								<p>Photos</p>
// 							</div>

// 							<div className="appContainer">
// 								{/* <Link to="/mobilecamera"> */}
// 									<img src={camera} alt='camera' className="app" />
// 								{/* </Link> */}

// 								<p>Camera</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={mail} alt='mail' className="app" />

// 								<p>Mail</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={clock} alt='clock' className="app" />

// 								<p>Clock</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={map} alt='map' className="app" />

// 								<p>Maps</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={weather} alt='weather' className="app" />

// 								<p>Weather</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={marks} alt='marks' className="app" />

// 								<p>Reminders</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={notes} alt='notes' className="app" />

// 								<p>Notes</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={heartbeat} alt='heartbeat' className="app" />

// 								<p>Stocks</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={zigzag} alt='zigzag' className="app" />

// 								<p>News</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={books} alt='books' className="app" />

// 								<p>Books</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={AppStore} alt='AppStore' className="app" />

// 								<p>App Store</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={Podcasts} alt='Podcasts' className="app" />

// 								<p>Podcasts</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={tv} alt='tv' className="app" />

// 								<p>TV</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={health} alt='health' className="app" />

// 								<p>Health</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={Home} alt='Home' className="app" />

// 								<p>Home</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={Wallet} alt='Wallet' className="app" />

// 								<p>Wallet</p>
// 							</div>

// 							<div className="appContainer">
// 								<img src={Settings} alt='Settings' className="app" />

// 								<p>Settings</p>
// 							</div>

// 						</div>

// 						<div className="dots">
// 							<div className="dot"></div>

// 							<div className="dot active"></div>

// 							<div className="dot"></div>
// 						</div>

// 						<div className="dock">
// 							<img src={phone} alt='phone' className="app" />

// 							<img src={safari} alt='safari' className="app" />

// 							<img src={iMessage} alt='iMessage' className="app" />

// 							<img src={music} alt='music' className="app" />
// 						</div>
// 					</div>

// 					<div className="dash bottom"></div>
// 				</div>
// 			</div>
			
// 			<div className="side right">
// 				<div className="dash right top"></div>

// 				{/* <a href="/index.html"> */}
// 				{/* <div className="side power" onclick="turnOffLock()"></div> */}
// 				<div className="side power" ></div>
// 				{/* </a> */}

// 				<div className="dash right bottom"></div>
// 			</div>
// 		</div>
//     </>
//   )
// }

// export default MobileHome


import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import "./styles.css";
import "./MainHome.css";
import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png";
import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png";
import videoCall from "../../media/assets/phone-simulator/Images/Apps/videoCall.png";
import date from "../../media/assets/phone-simulator/Images/Apps/date.png";
import flower from "../../media/assets/phone-simulator/Images/Apps/flower.png";
import camera from "../../media/assets/phone-simulator/Images/Apps/camera.png";
import mail from "../../media/assets/phone-simulator/Images/Apps/mail.png";
import clock from "../../media/assets/phone-simulator/Images/Apps/clock.png";
import map from "../../media/assets/phone-simulator/Images/Apps/map.png";
import weather from "../../media/assets/phone-simulator/Images/Apps/weather.png";
import marks from "../../media/assets/phone-simulator/Images/Apps/marks.png";
import notes from "../../media/assets/phone-simulator/Images/Apps/notes.png";
import heartbeat from "../../media/assets/phone-simulator/Images/Apps/heartbeat.png";
import zigzag from "../../media/assets/phone-simulator/Images/Apps/zigzag.png";
import books from "../../media/assets/phone-simulator/Images/Apps/books.png";
import AppStore from "../../media/assets/phone-simulator/Images/Apps/AppStore.png";
import Podcasts from "../../media/assets/phone-simulator/Images/Apps/Podcasts.png";
import tv from "../../media/assets/phone-simulator/Images/Apps/tv.png";
import health from "../../media/assets/phone-simulator/Images/Apps/health.png";
import Home from "../../media/assets/phone-simulator/Images/Apps/Home.png";
import Wallet from "../../media/assets/phone-simulator/Images/Apps/Wallet.png";
import Settings from "../../media/assets/phone-simulator/Images/Apps/Settings.png";
import phone from "../../media/assets/phone-simulator/Images/Apps/phone.png";
import safari from "../../media/assets/phone-simulator/Images/Apps/safari.png";
import iMessage from "../../media/assets/phone-simulator/Images/Apps/iMessage.png";
import music from "../../media/assets/phone-simulator/Images/Apps/music.png";

const MobileHome: React.FC = () => {
  const [isPoweredOn, setIsPoweredOn] = useState(true);

  const togglePower = () => {
    setIsPoweredOn(!isPoweredOn);
  };

  const iphoneHomeStyle = {
    backgroundColor: isPoweredOn ? '' : 'black', // Black background when off
    backgroundImage: isPoweredOn ? 'url(/src/client/media/assets/phone-simulator/Images/Backgrounds/homescreen.jpeg)' : 'none', // Toggle background image
    transition: 'background 0.5s ease' // Smooth transition for visual effects
  };

  const innerStyle = {
    opacity: isPoweredOn ? '1' : '0', // Control opacity to simulate screen on/off
    transition: 'opacity 0.5s ease'  // Smooth transition for turning on/off
  };

  const phoneStyle = {
    backgroundColor: isPoweredOn ? '' : 'black', // Black background when off
    transition: 'background-color 0.5s ease'     // Smooth transition for background color
  };

  return (
    <>
      <div className="main" style={phoneStyle}>
        <div className="side left">
          <div className="dash left top"></div>
          <div className="audio">
            <div className="side ringer"></div>
            <div className="side volume up"></div>
            <div className="side volume down"></div>
          </div>
          <div className="dash left bottom"></div>
        </div>

		<div className="iphone home" id="iphone" style={iphoneHomeStyle}>
          <div className="dash top"></div>

          <div className="inner" id="inner" style={innerStyle}>
            <div className="top">
              <div className="left">
                <p className="time">9:41</p>
              </div>
              <div className="center"> 
                <div className="mic"></div>
                <div className="cam"></div>
              </div>
              <div className="right">
                <img src={wifi} alt='wifi' className="wifi" />
                <img src={battery} alt='battery' className="battery" />
              </div>
            </div>

            <div className="content">
              <div className="icons">
                {[
                  { src: videoCall, label: 'FaceTime' },
                  { src: date, label: 'Calendar' },
                  { src: flower, label: 'Photos' },
                  { src: camera, label: 'Camera' },
                  { src: mail, label: 'Mail' },
                  { src: clock, label: 'Clock' },
                  { src: map, label: 'Maps' },
                  { src: weather, label: 'Weather' },
                  { src: marks, label: 'Reminders' },
                  { src: notes, label: 'Notes' },
                  { src: heartbeat, label: 'Stocks' },
                  { src: zigzag, label: 'News' },
                  { src: books, label: 'Books' },
                  { src: AppStore, label: 'App Store' },
                  { src: Podcasts, label: 'Podcasts' },
                  { src: tv, label: 'TV' },
                  { src: health, label: 'Health' },
                  { src: Home, label: 'Home' },
                  { src: Wallet, label: 'Wallet' },
                  { src: Settings, label: 'Settings' }
                ].map((app, index) => (
                  <div key={index} className="appContainer">
                    <img src={app.src} alt={app.label} className="app" />
                    <p>{app.label}</p>
                  </div>
                ))}
              </div>

              <div className="dots">
                <div className="dot"></div>
                <div className="dot active"></div>
                <div className="dot"></div>
              </div>

              <div className="dock">
                <img src={phone} alt='phone' className="app" />
                <img src={safari} alt='safari' className="app" />
                <img src={iMessage} alt='iMessage' className="app" />
                <img src={music} alt='music' className="app" />
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
}

export default MobileHome;



// import React, { useState } from 'react';
// import { Link } from 'react-router-dom';
// import "./styles.css";
// import "./MainHome.css";
// import wifi from "../../media/assets/phone-simulator/Images/Icons/wifi.png";
// import battery from "../../media/assets/phone-simulator/Images/Icons/battery.png";
// import videoCall from "../../media/assets/phone-simulator/Images/Apps/videoCall.png";
// import date from "../../media/assets/phone-simulator/Images/Apps/date.png";
// import flower from "../../media/assets/phone-simulator/Images/Apps/flower.png";
// import camera from "../../media/assets/phone-simulator/Images/Apps/camera.png";
// import mail from "../../media/assets/phone-simulator/Images/Apps/mail.png";
// import clock from "../../media/assets/phone-simulator/Images/Apps/clock.png";
// import map from "../../media/assets/phone-simulator/Images/Apps/map.png";
// import weather from "../../media/assets/phone-simulator/Images/Apps/weather.png";
// import marks from "../../media/assets/phone-simulator/Images/Apps/marks.png";
// import notes from "../../media/assets/phone-simulator/Images/Apps/notes.png";
// import heartbeat from "../../media/assets/phone-simulator/Images/Apps/heartbeat.png";
// import zigzag from "../../media/assets/phone-simulator/Images/Apps/zigzag.png";
// import books from "../../media/assets/phone-simulator/Images/Apps/books.png";
// import AppStore from "../../media/assets/phone-simulator/Images/Apps/AppStore.png";
// import Podcasts from "../../media/assets/phone-simulator/Images/Apps/Podcasts.png";
// import tv from "../../media/assets/phone-simulator/Images/Apps/tv.png";
// import health from "../../media/assets/phone-simulator/Images/Apps/health.png";
// import Home from "../../media/assets/phone-simulator/Images/Apps/Home.png";
// import Wallet from "../../media/assets/phone-simulator/Images/Apps/Wallet.png";
// import Settings from "../../media/assets/phone-simulator/Images/Apps/Settings.png";
// import phone from "../../media/assets/phone-simulator/Images/Apps/phone.png";
// import safari from "../../media/assets/phone-simulator/Images/Apps/safari.png";
// import iMessage from "../../media/assets/phone-simulator/Images/Apps/iMessage.png";
// import music from "../../media/assets/phone-simulator/Images/Apps/music.png";

// const MobileHome: React.FC = () => {
//   const [isPoweredOn, setIsPoweredOn] = useState(true);

//   const togglePower = () => {
//     setIsPoweredOn(!isPoweredOn);
//   };

//   const iphoneHomeStyle = {
//     backgroundColor: isPoweredOn ? '' : 'black', // Black background when off
//     backgroundImage: isPoweredOn ? 'url(/src/client/media/assets/phone-simulator/Images/Backgrounds/homescreen.jpeg)' : 'none', // Toggle background image
//     transition: 'background 0.5s ease' // Smooth transition for visual effects
//   };

//   const innerStyle = {
//     opacity: isPoweredOn ? '1' : '0', // Control opacity to simulate screen on/off
//     transition: 'opacity 0.5s ease'  // Smooth transition for turning on/off
//   };

//   return (
//     <>
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

//         <div className="iphone home" id="iphone" style={iphoneHomeStyle}>
//           <div className="dash top"></div>
//           <div className="inner" id="inner" style={innerStyle}>
//             <div className="top">
//               <div className="left">
//                 <p className="time">9:41</p>
//               </div>
//               <div className="center">
//                 <div className="mic"></div>
//                 <div className="cam"></div>
//               </div>
//               <div className="right">
//                 <img src={wifi} alt='wifi' className="wifi" />
//                 <img src={battery} alt='battery' className="battery" />
//               </div>
//             </div>
//             {/* Include other components and app icons as in the previous example */}
//           </div>
//         </div>
        
//         <div className="side right">
//           <div className="dash right top"></div>
//           <div className="side power" onClick={togglePower}></div>
//           <div className="dash right bottom"></div>
//         </div>
//       </div>
//     </>
//   );
// }

// export default MobileHome;
