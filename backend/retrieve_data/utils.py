def pressure_to_elevation(pressure):
    return 44330 * (1 - (pressure/1013.25)**(1/5.255))
