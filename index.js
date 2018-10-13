let Characteristic
let Service

module.exports = homebridge => {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-arlo', 'Arlo', Arlo)
}

class Arlo {
  constructor(log, config) {
    this.config = config

    console.log('constructor:', config)
  }

  getCurrentState(callback) {
    console.log('getCurrentState')

    callback(true)
  }

  getServices() {
    this.securityService = new Service.SecuritySystem(this.config.name);

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getCurrentState.bind(this))

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('get', this.getTargetState.bind(this))
      .on('set', this.setTargetState.bind(this))

    return [
      this.securityService
    ]
  }

  identify(callback) {
    callback()
  }

  init() {
    console.log('init!')
  }

  setTargetState(state, callback) {
    console.log('setTargetState:', {state})

    callback(state)
  }
}
