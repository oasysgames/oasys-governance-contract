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
const shuffle = <T>(arr: T[]) => arr.sort(() => Math.random() - Math.random())

describe('EVMAccessControl', function () {
  async function deployContractsFixture() {
    // admins and managers
    const [admin, manager1, manager2, newAdmin, newManager, creator, caller, signer1, signer2, signer3, attacker] =
      await ethers.getSigners()
    const admins: HardhatEthersSigner[] = [admin]
    const managers: HardhatEthersSigner[] = [manager1, manager2]
    const addresses: string[] = [signer1.address, signer2.address, signer3.address]
    // deploy
    const Controller = await ethers.getContractFactory('ExtendEVMAccessControl')
    const controller = await Controller.deploy([admin.address], [manager1.address, manager2.address])
    // roles
    const adminRole = await controller.DEFAULT_ADMIN_ROLE()
    const managerRole = await controller.MANAGER_ROLE()
    return {
      controller,
      admins,
      managers,
      newAdmin,
      newManager,
      creator,
      caller,
      addresses,
      attacker,
      adminRole,
      managerRole,
    }
  }

  describe('Deployment', function () {
    it('Should set the right admins and managers and prev and version', async function () {
      const { controller, admins, managers, adminRole, managerRole } = await loadFixture(deployContractsFixture)

      for (const admin of admins) {
        expect(await controller.hasRole(adminRole, admin)).to.be.true
      }
      for (const _creator of managers) {
        expect(await controller.hasRole(managerRole, _creator)).to.be.true
      }
      expect(await controller.version()).to.equal('1.0.0')
    })
  })

  describe('addCreateAllowedList/removeCreateAllowedList', function () {
    it('succeed', async function () {
      let { controller, managers, addresses } = await loadFixture(deployContractsFixture)

      // Add addresses to allowed list
      let last = SENTINEL_ADDRESS
      for (const addr of shuffle(addresses)) {
        expect(await controller.isAllowedToCreate(addr)).to.be.false

        const receipt = await controller.connect(managers[0]).addCreateAllowedList(addr)
        await expect(receipt).to.emit(controller, 'CreateAllowed').withArgs(addr)
        expect(await controller.isAllowedToCreate(addr)).to.be.true

        const storageKey = await controller.computeMapStorageKey(leftPadAddressToBytes32(addr), 1)
        expect(await controller.accessMapValue(storageKey)).to.equal(leftPadAddressToBytes32(last))

        last = addr
      }

      // Remove addresses from allowed list
      for (const addr of shuffle(addresses)) {
        const receipt = await controller.connect(managers[0]).removeCreateAllowedList(addr, ZERO_ADDRESS)
        await expect(receipt).to.emit(controller, 'CreateDenied').withArgs(addr)
        expect(await controller.isAllowedToCreate(addr)).to.be.false

        const storageKey = await controller.computeMapStorageKey(leftPadAddressToBytes32(addr), 1)
        expect(await controller.accessMapValue(storageKey)).to.equal(leftPadAddressToBytes32(ZERO_ADDRESS))
      }
    })

    it('revert by ungranted caller', async function () {
      const { controller, creator, attacker, managerRole } = await loadFixture(deployContractsFixture)

      // try to add creator to allowed list
      await expect(controller.connect(attacker).addCreateAllowedList(creator.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )

      // try to remove creator from allowed list
      await expect(
        controller.connect(attacker).removeCreateAllowedList(creator.address, ZERO_ADDRESS),
      ).to.be.revertedWith(`AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`)
    })

    it('revert by sanity checks', async () => {
      const { controller, managers } = await loadFixture(deployContractsFixture)
      const c = controller.connect(managers[0])

      await expect(c.addCreateAllowedList(ZERO_ADDRESS)).to.be.revertedWith('EAC: addr is zero')
      await expect(c.addCreateAllowedList(await c.getAddress())).to.be.revertedWith('EAC: addr is self')
      await expect(c.addCreateAllowedList(SENTINEL_ADDRESS)).to.be.revertedWith('EAC: addr is sentinel')
    })

    it('revert by already added', async function () {
      const { controller, managers, creator } = await loadFixture(deployContractsFixture)
      const c = controller.connect(managers[0])

      // duppliate add
      await c.addCreateAllowedList(creator.address)
      await expect(c.addCreateAllowedList(creator.address)).to.be.revertedWith('EAC: already exists')

      // duppliate remove
      await c.removeCreateAllowedList(creator.address, ZERO_ADDRESS)
      await expect(c.removeCreateAllowedList(creator.address, ZERO_ADDRESS)).to.be.revertedWith('EAC: not found')
    })
  })

  describe('addCallDeniedList/removeCallDeniedList', function () {
    it('succeed', async function () {
      const { controller, managers, addresses } = await loadFixture(deployContractsFixture)

      // Add addresses to denied list
      let last = SENTINEL_ADDRESS
      for (const addr of shuffle(addresses)) {
        expect(await controller.isDeniedToCall(addr)).to.be.false

        const receipt = await controller.connect(managers[0]).addCallDeniedList(addr)
        await expect(receipt).to.emit(controller, 'CallDenied').withArgs(addr)
        expect(await controller.isDeniedToCall(addr)).to.be.true

        const storageKey = await controller.computeMapStorageKey(leftPadAddressToBytes32(addr), 2)
        expect(await controller.accessMapValue(storageKey)).to.equal(leftPadAddressToBytes32(last))

        last = addr
      }
    })

    it('revert by ungranted caller', async function () {
      const { controller, caller, attacker, managerRole } = await loadFixture(deployContractsFixture)

      // try to add caller to denied list
      await expect(controller.connect(attacker).addCallDeniedList(caller.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )

      // try to remove caller from denied list
      await expect(controller.connect(attacker).removeCallDeniedList(caller.address, ZERO_ADDRESS)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )
    })

    it('revert by sanity checks', async () => {
      const { controller, managers } = await loadFixture(deployContractsFixture)
      const c = controller.connect(managers[0])

      await expect(c.addCallDeniedList(ZERO_ADDRESS)).to.be.revertedWith('EAC: addr is zero')
      await expect(c.addCallDeniedList(await c.getAddress())).to.be.revertedWith('EAC: addr is self')
      await expect(c.addCallDeniedList(SENTINEL_ADDRESS)).to.be.revertedWith('EAC: addr is sentinel')
    })

    it('revert by already added', async function () {
      const { controller, managers, caller } = await loadFixture(deployContractsFixture)
      const c = controller.connect(managers[0])

      // duppliate add
      await c.addCallDeniedList(caller.address)
      await expect(c.addCallDeniedList(caller.address)).to.be.revertedWith('EAC: already exists')

      // duppliate remove
      await c.removeCallDeniedList(caller.address, ZERO_ADDRESS)
      await expect(c.removeCallDeniedList(caller.address, ZERO_ADDRESS)).to.be.revertedWith('EAC: not found')
    })
  })

  describe('listCreateAllowed/listCallDenied', function () {
    it('succeed', async () => {
      const addrCount = 50
      const addrOffset = 256

      const addresses = [] as string[]
      const revaddresses = [] as string[]
      for (let i = addrOffset; i < addrOffset + addrCount; i++) {
        addresses.push(toChecksumAddress(hexZeroPad('0x' + i.toString(16), 20)))
      }
      revaddresses.push(...[...addresses].reverse())

      const { controller, managers } = await loadFixture(deployContractsFixture)
      for (const addr of addresses) {
        await controller.connect(managers[0]).addCreateAllowedList(addr)
        await controller.connect(managers[0]).addCallDeniedList(addr)
      }

      // When howMany is sufficiently
      expect(await controller.listCreateAllowed(ZERO_ADDRESS, addrCount)).to.deep.equal(revaddresses)
      expect(await controller.listCallDenied(ZERO_ADDRESS, addrCount)).to.deep.equal(revaddresses)

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

        expect(await controller.listCreateAllowed(cursor, howMany)).to.deep.equal(expects)
        expect(await controller.listCallDenied(cursor, howMany)).to.deep.equal(expects)

        cursor = expects[expects.length - 1]
      }
    })
  })

  describe('grantRole', function () {
    it('Should succeed to grant admin role', async function () {
      const { controller, admins, newAdmin, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).grantRole(adminRole, newAdmin.address))
        .to.emit(controller, 'RoleGranted')
        .withArgs(adminRole, newAdmin.address, admins[0].address)
      expect(await controller.hasRole(adminRole, newAdmin.address)).to.true
    })

    it('Should succeed to grant create role', async function () {
      const { controller, admins, newManager, managerRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).grantRole(managerRole, newManager.address))
        .to.emit(controller, 'RoleGranted')
        .withArgs(managerRole, newManager.address, admins[0].address)
      expect(await controller.hasRole(managerRole, newManager.address)).to.true
    })

    it('Should revert by ungranted caller', async function () {
      const { controller, newManager, managers, managerRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(managers[1]).grantRole(managerRole, newManager.address)).to.be.revertedWith(
        `AccessControl: account ${managers[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })

  describe('revokeRole', function () {
    it('Should succeed to revoke admin role', async function () {
      const { controller, admins, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).revokeRole(adminRole, admins[0].address))
        .to.emit(controller, 'RoleRevoked')
        .withArgs(adminRole, admins[0].address, admins[0].address)
      expect(await controller.hasRole(adminRole, admins[0].address)).to.false
    })

    it('Should succeed to revoke controller role', async function () {
      const { controller, managers, admins, managerRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).revokeRole(managerRole, managers[1].address))
        .to.emit(controller, 'RoleRevoked')
        .withArgs(managerRole, managers[1].address, admins[0].address)
      expect(await controller.hasRole(managerRole, managers[1].address)).to.false
    })

    it('Should revert by ungranted caller', async function () {
      const { controller, managers, managerRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(managers[1]).revokeRole(managerRole, managers[0].address)).to.be.revertedWith(
        `AccessControl: account ${managers[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })
})
