# homebridge-arlo-basestation

> Homebridge plugin for integrating Arlo with HomeKit.

## Overview

[Arlo by Netgear](https://www.arlo.com/en-us/) isn't natively compatible with Apple's HomeKit, but you can use [Homebridge](https://github.com/nfarina/homebridge) in conjunction with this plugin to create a basic integration.

This plugin **does not add any cameras** to HomeKit – for that, you should try [`homebridge-arlo`](https://github.com/devbobo/homebridge-arlo). Instead, this plugin adds the Arlo base station as a security system to HomeKit, allowing you to arm and disarm the system via HomeKit. For example, this means you can create a "good night" scene that turns off all your lights, closes the blinds and arms the security system.

## Installation

1. Ensure you have [Homebridge](https://github.com/nfarina/homebridge) installed.

2. Install the plugin as a global npm module

    ```bash
    [sudo] npm install -g homebridge-arlo-basestation
    ```

3. Add the accessory to your Homebridge `config.json` (see [Configuration](#configuration)).

## Configuration

You must add an entry to your `accessories` array, following the example below:

```json
{
    "accessories": [
        {
            "accessory": "Arlo",
            "name": "Arlo",
            "authentication": {
                "email": "john.appleseed@apple.com",
                "password": "WeWantHomeKitSupport!"
            }
        }
    ]    
}
```

The `email` and `password` properties define your Arlo credentials. Note that you can only be signed in to Arlo in one device at a time, so I recommend that you create a different account just for Homebridge and grant it permissions to your Arlo system.
