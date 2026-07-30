import { getUsers } from "@/actions/user.actions"
import UsersClient from "./UsersClient"

export default async function AdminUsersPage() {
    const users = await getUsers()

    return <UsersClient initialUsers={users} />
}
