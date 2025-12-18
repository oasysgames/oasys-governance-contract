import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { hexZeroPad } from '@ethersproject/bytes'
import { toChecksumAddress } from 'web3-utils'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SENTINEL_ADDRESS = '0x0000000000000000000000000000000000000001'
const leftPadAddressToBytes32 = (address: string) => {
  const cleanAddress = address.toLowerCase().replace(/^0x/, '')
  const paddedAddress = '0'.repeat(64 - cleanAddress.length) + cleanAddress
  return '0x' + paddedAddress
}
const shuffle = <T>(arr: T[]) => {
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

describe('TransactionBlocker', function () {
  async function deployContractsFixture() {
    // admins and managers
    const [admin, manager1, manager2, newAdmin, newManager, blockedAddr, caller, signer1, signer2, signer3, attacker] =
      await ethers.getSigners()
    const admins: HardhatEthersSigner[] = [admin]
    const managers: HardhatEthersSigner[] = [manager1, manager2]
    const addresses: string[] = [signer1.address, signer2.address, signer3.address]
    // deploy
    const TransactionBlocker = await ethers.getContractFactory('ExtendTransactionBlocker')
    const blocker = await TransactionBlocker.deploy([admin.address], [manager1.address, manager2.address])
    // roles
    const adminRole = await blocker.DEFAULT_ADMIN_ROLE()
    const managerRole = await blocker.MANAGER_ROLE()
    return {
      blocker,
      admins,
      managers,
      newAdmin,
      newManager,
      blockedAddr,
      caller,
      addresses,
      attacker,
      adminRole,
      managerRole,
    }
  }

  describe('Deployment', function () {
    it('Should set the right admins and managers and version', async function () {
      const { blocker, admins, managers, adminRole, managerRole } = await loadFixture(deployContractsFixture)

      for (const admin of admins) {
        expect(await blocker.hasRole(adminRole, admin)).to.be.true
      }
      for (const _manager of managers) {
        expect(await blocker.hasRole(managerRole, _manager)).to.be.true
      }
      expect(await blocker.version()).to.equal('1.0.0')
      expect(await blocker.isBlockedAll()).to.be.false
    })
  })

  describe('setBlockedAll', function () {
    it('Should succeed to set blocked all to true', async function () {
      const { blocker, managers } = await loadFixture(deployContractsFixture)

      expect(await blocker.isBlockedAll()).to.be.false
      await expect(blocker.connect(managers[0]).setBlockedAll(true)).to.emit(blocker, 'BlockedAllSet').withArgs(true)
      expect(await blocker.isBlockedAll()).to.be.true
    })

    it('Should succeed to set blocked all to false', async function () {
      const { blocker, managers } = await loadFixture(deployContractsFixture)

      await blocker.connect(managers[0]).setBlockedAll(true)
      expect(await blocker.isBlockedAll()).to.be.true

      await expect(blocker.connect(managers[0]).setBlockedAll(false)).to.emit(blocker, 'BlockedAllSet').withArgs(false)
      expect(await blocker.isBlockedAll()).to.be.false
    })

    it('Should revert by ungranted caller', async function () {
      const { blocker, attacker, managerRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(attacker).setBlockedAll(true)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )
    })
  })

  describe('addBlockedList/removeBlockedList', function () {
    it('succeed', async function () {
      let { blocker, managers, addresses } = await loadFixture(deployContractsFixture)

      // Add addresses to blocked list
      let last = SENTINEL_ADDRESS
      for (const addr of shuffle(addresses)) {
        expect(await blocker.isBlockedAddress(addr)).to.be.false

        const receipt = await blocker.connect(managers[0]).addBlockedList(addr)
        await expect(receipt).to.emit(blocker, 'BlockedAddressAdded').withArgs(addr)
        expect(await blocker.isBlockedAddress(addr)).to.be.true

        const storageKey = await blocker.computeMapStorageKey(leftPadAddressToBytes32(addr), 1)
        expect(await blocker.accessMapValue(storageKey)).to.equal(leftPadAddressToBytes32(last))

        last = addr
      }

      // Remove addresses from blocked list
      for (const addr of shuffle(addresses)) {
        const receipt = await blocker.connect(managers[0]).removeBlockedList(addr, ZERO_ADDRESS)
        await expect(receipt).to.emit(blocker, 'BlockedAddressRemoved').withArgs(addr)
        expect(await blocker.isBlockedAddress(addr)).to.be.false

        const storageKey = await blocker.computeMapStorageKey(leftPadAddressToBytes32(addr), 1)
        expect(await blocker.accessMapValue(storageKey)).to.equal(leftPadAddressToBytes32(ZERO_ADDRESS))
      }
    })

    it('revert by ungranted caller', async function () {
      const { blocker, blockedAddr, attacker, managerRole } = await loadFixture(deployContractsFixture)

      // try to add address to blocked list
      await expect(blocker.connect(attacker).addBlockedList(blockedAddr.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )

      // try to remove address from blocked list
      await expect(blocker.connect(attacker).removeBlockedList(blockedAddr.address, ZERO_ADDRESS)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )
    })

    it('revert by sanity checks', async () => {
      const { blocker, managers } = await loadFixture(deployContractsFixture)
      const c = blocker.connect(managers[0])

      await expect(c.addBlockedList(ZERO_ADDRESS)).to.be.revertedWith('EAC: addr is zero')
      await expect(c.addBlockedList(await c.getAddress())).to.be.revertedWith('EAC: addr is self')
      await expect(c.addBlockedList(SENTINEL_ADDRESS)).to.be.revertedWith('EAC: addr is sentinel')
    })

    it('revert by already added', async function () {
      const { blocker, managers, blockedAddr } = await loadFixture(deployContractsFixture)
      const c = blocker.connect(managers[0])

      // duplicate add
      await c.addBlockedList(blockedAddr.address)
      await expect(c.addBlockedList(blockedAddr.address)).to.be.revertedWith('EAC: already exists')

      // duplicate remove
      await c.removeBlockedList(blockedAddr.address, ZERO_ADDRESS)
      await expect(c.removeBlockedList(blockedAddr.address, ZERO_ADDRESS)).to.be.revertedWith('EAC: not found')
    })
  })

  describe('listBlockedAddresses', function () {
    it('succeed', async () => {
      const addrCount = 50
      const addrOffset = 256

      const addresses = [] as string[]
      const revaddresses = [] as string[]
      for (let i = addrOffset; i < addrOffset + addrCount; i++) {
        addresses.push(toChecksumAddress(hexZeroPad('0x' + i.toString(16), 20)))
      }
      revaddresses.push(...[...addresses].reverse())

      const { blocker, managers } = await loadFixture(deployContractsFixture)
      for (const addr of addresses) {
        await blocker.connect(managers[0]).addBlockedList(addr)
      }

      // When howMany is sufficient
      expect(await blocker.listBlockedAddresses(ZERO_ADDRESS, addrCount)).to.deep.equal(revaddresses)

      // When using pagination
      const howMany = 15
      const pageSize = Math.ceil(addrCount / howMany)

      let cursor = ZERO_ADDRESS
      for (let page = 0; page < pageSize; page++) {
        const offset = howMany * page
        const expects = revaddresses.slice(offset, offset + howMany)

        // The last page is padded with null addresses if there are insufficient entries.
        if (page === pageSize - 1) {
          const insufficients = howMany - (addrCount - offset)
          for (let i = 0; i < insufficients; i++) {
            expects.push(ZERO_ADDRESS)
          }
        }

        expect(await blocker.listBlockedAddresses(cursor, howMany)).to.deep.equal(expects)

        cursor = expects[expects.length - 1]
      }
    })
  })

  describe('grantRole', function () {
    it('Should succeed to grant admin role', async function () {
      const { blocker, admins, newAdmin, adminRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(admins[0]).grantRole(adminRole, newAdmin.address))
        .to.emit(blocker, 'RoleGranted')
        .withArgs(adminRole, newAdmin.address, admins[0].address)
      expect(await blocker.hasRole(adminRole, newAdmin.address)).to.true
    })

    it('Should succeed to grant manager role', async function () {
      const { blocker, admins, newManager, managerRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(admins[0]).grantRole(managerRole, newManager.address))
        .to.emit(blocker, 'RoleGranted')
        .withArgs(managerRole, newManager.address, admins[0].address)
      expect(await blocker.hasRole(managerRole, newManager.address)).to.true
    })

    it('Should revert by ungranted caller', async function () {
      const { blocker, newManager, managers, managerRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(managers[1]).grantRole(managerRole, newManager.address)).to.be.revertedWith(
        `AccessControl: account ${managers[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })

  describe('revokeRole', function () {
    it('Should succeed to revoke admin role', async function () {
      const { blocker, admins, adminRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(admins[0]).revokeRole(adminRole, admins[0].address))
        .to.emit(blocker, 'RoleRevoked')
        .withArgs(adminRole, admins[0].address, admins[0].address)
      expect(await blocker.hasRole(adminRole, admins[0].address)).to.false
    })

    it('Should succeed to revoke manager role', async function () {
      const { blocker, managers, admins, managerRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(admins[0]).revokeRole(managerRole, managers[1].address))
        .to.emit(blocker, 'RoleRevoked')
        .withArgs(managerRole, managers[1].address, admins[0].address)
      expect(await blocker.hasRole(managerRole, managers[1].address)).to.false
    })

    it('Should revert by ungranted caller', async function () {
      const { blocker, managers, managerRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(blocker.connect(managers[1]).revokeRole(managerRole, managers[0].address)).to.be.revertedWith(
        `AccessControl: account ${managers[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })
})
