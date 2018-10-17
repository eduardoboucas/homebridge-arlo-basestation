const EventSource = require('eventsource')
const fetch = require('node-fetch')
const packageJSON = require('./package.json')

const SECOND = 1000
const STATE = {
  ARLO: {
    ARMED: 'mode1',
    DISARMED: 'mode0'
  },
  HOMEKIT: {
    HOME: 0,
    AWAY: 1,
    NIGHT: 2,
    OFF: 3
  }
}

let Characteristic
let Service

module.exports = homebridge => {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-arlo', 'Arlo', Arlo)
}

class Arlo {
  constructor(log, config) {
    this.API_URL = 'https://arlo.netgear.com/hmsweb'

    this.config = config
    this.log = log
    this.name = config.name
    this.pollingInterval = config.pollingInterval || (30 * SECOND)
    this.state = STATE.HOMEKIT.AWAY

    this.initialise()
  }

  authenticate({email, password}) {
    return this.sendRequest({
      body: {
        email,
        password
      },
      url: '/login/v2'
    }).then(response => {
      let token = response.data && response.data.token

      return token
    })
  }

  convertArloModeToHomeKitState(state) {
    if (state === STATE.ARLO.ARMED) {
      return STATE.HOMEKIT.AWAY
    }

    return STATE.HOMEKIT.OFF
  }

  convertHomeKitStateToArloMode(state) {
    if (state === STATE.HOMEKIT.OFF) {
      return STATE.ARLO.DISARMED
    }

    return STATE.ARLO.ARMED
  }

  getActiveMode() {
    return this.sendRequest({
      authenticate: true,
      headers: {
        xcloudid: this.baseStation.xCloudId
      },
      url: '/users/devices/automation/active'
    }).then(response => {
      let arloMode = response.data[0].activeModes[0]
      let state = this.convertArloModeToHomeKitState(arloMode)

      return state
    })
  }

  getBaseStation() {
    return this.sendRequest({
      authenticate: true,
      url: '/users/devices'
    }).then(({data}) => {
      let baseStation = data.find(device => {
        return device.deviceType === 'basestation'
      })

      return baseStation
    })
  }

  getCurrentState(callback) {
    this.log('Getting current state:', this.state)

    callback(null, this.state)
  }

  getServices() {
    this.securityService = new Service.SecuritySystem(this.name)

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getCurrentState.bind(this))

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('get', this.getTargetState.bind(this))
      .on('set', this.setTargetState.bind(this))

    this.securityService
      .setCharacteristic(Characteristic.Manufacturer, packageJSON.author)
      .setCharacteristic(Characteristic.Model, packageJSON.version)
      .setCharacteristic(Characteristic.SerialNumber, packageJSON.version)
      .setCharacteristic(Characteristic.FirmwareRevision, packageJSON.version)

    return [
      this.securityService
    ]
  }

  getTargetState(callback) {
    callback(null, this.state)
  }

  identify(callback) {
    callback()
  }

  initialise() {
    return this.authenticate({
      email: this.config.authenticationPrimary.email,
      password: this.config.authenticationPrimary.password
    }).then(token => {
      this.token = token

      return this.authenticate({
        email: this.config.authenticationSecondary.email,
        password: this.config.authenticationSecondary.password
      })
    }).then(token => {
      this.tokenPolling = token

      return this.getBaseStation()
    }).then(baseStation => {
      this.baseStation = baseStation

      return this.getActiveMode()
    }).then(newState => {
      this.setCurrentState(newState)
      this.setupEventSubscriber()
      this.setupPolling()
    }).catch(this.log.bind(this))
  }

  sendRequest({
    authenticate = false,
    body: payload,
    headers: inputHeaders = {},
    method = 'GET',
    url
  }) {
    let body
    let headers = Object.assign(inputHeaders, {
      'content-type': 'application/json'
    })

    if (authenticate) {
      headers.Authorization = this.token
    }

    if (payload) {
      body = JSON.stringify(payload)
      method = 'POST'
    }

    return fetch(this.API_URL + url, {
      body,
      headers,
      method
    }).then(response => response.json())
  }

  setArloMode(state) {
    let arloMode = this.convertHomeKitStateToArloMode(state)

    return this.sendRequest({
      authenticate: true,
      body: {
        from: `${this.baseStation.userId}_web`,
        to: this.baseStation.deviceId,
        action: 'set',
        resource: 'modes',
        transId: Date.now().toString(),
        publishResponse: true,
        properties: {
          active: arloMode
        }
      },
      headers: {
        xcloudid: this.baseStation.xCloudId
      },
      method: 'POST',
      url: `/users/devices/notify/${this.baseStation.deviceId}`
    })
  }

  setCurrentState(state) {
    this.log('Setting current state:', state)

    this.state = state

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .setValue(state)
  }

  setTargetState(state, callback) {
    this.log('Setting target state:', state)

    return this.setArloMode(state).then(({success}) => {
      if (success === true) {
        this.setCurrentState(state)

        callback(null, state)
      }
    })
  }

  setupEventSubscriber() {
    this.log('Initialising event subscriber')

    let eventSource = new EventSource(`${this.API_URL}/client/subscribe?token=${this.tokenPolling}`, {
      headers: {
        Accept: 'text/event-stream',
        Host: 'arlo.netgear.com',
        Referer: 'https://arlo.netgear.com/'
      },
      https: {
        rejectUnauthorized: false
      }
    })

    eventSource.onerror = event => {
      this.log('Error from event subscriber:', event)
    }

    eventSource.onmessage = event => {
      this.log(event)

      if (event.type === 'message') {
        try {
          let data = JSON.parse(event.data)
          let baseStationData = data && data[this.baseStation.deviceId]

          if (!baseStationData) {
            return
          }

          let newArloMode = baseStationData.activeModes[0]
          let newHomekitState = this.convertArloModeToHomeKitState(newArloMode)

          if (newHomekitState !== this.state) {
            this.setCurrentState(newHomekitState)
          }
        } catch (error) {
          this.log(error)
        }
      }
    }

    eventSource.onopen = event => {
      this.log('Event subscriber has been initialised')
    }    
  }

  setupPolling() {
    this.log('Initialising polling agent')

    this.pollingAgent = setInterval(() => {
      this.log('Polling for changes in Arlo mode')

      this.getActiveMode().then(newState => {
        if (newState !== this.state) {
          this.securityService
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .setValue(newState)

          this.setCurrentState(newState)
        }
      })
    }, this.pollingInterval)
  }
}
