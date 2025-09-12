function say(s) {
  document.getElementById("dps").innerHTML=s
}
var i=0
function speak() {
  i^=1
  if (i) {
    if (Math.random() < 0.10) {
      say("Don't be a<br> sussy baka!")
    } else {
      say("Download today!")
    }
  } else {
    say("Get me outta<br> this website!")
  }
}

function blink() {
  if (Math.random() < 0.03) {
    document.getElementById('dps-girl').src="girlb.png"
  } else {
    document.getElementById('dps-girl').src="girl.gif"
  }
}

function poke () {
  say("Ouch!")
}

function init() {
  setInterval(speak, 1000)
  // setInterval(blink, 100)
}

document.onload = init()
