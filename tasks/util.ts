export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const assertAddresses = (addresses: string): string[] => {
  const addressList = addresses.split(',')

  if (addressList.length < 1) {
    throw new Error('No num provided')
  }

  // Checks if the address has the correct length and hex characters
  const re = /^(0x)[0-9a-fA-F]{40}$/
  for (const addr of addressList) {
    if (!re.test(addr)) {
      throw new Error(`${addr} is not a valid address`)
    }
  }

  return addressList
}
