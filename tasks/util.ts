import fs from 'fs'
import csv from 'csv-parser'

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

export function readCSV(filePath: string) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error('failed to find csv: ' + filePath))
      return
    }

    const results: any[] = []
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results)
      })
      .on('error', (err) => reject(err))
  })
}

export function writeJsonToFile(jsonObj: any, filePath: string) {
  const jsonString = JSON.stringify(jsonObj, null);

  // ファイルに書き込む
  fs.writeFileSync(filePath, jsonString, 'utf8');
}

export function splitArray<T>(array: T[]): [T[], T[]] {
  const middle = Math.ceil(array.length / 2)
  const firstHalf = array.slice(0, middle)
  const secondHalf = array.slice(middle)
  return [firstHalf, secondHalf]
}
