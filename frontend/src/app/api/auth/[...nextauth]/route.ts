/**
 * @fileoverview Ruta de API para NextAuth
 * @author SOFIA - Builder
 * @id IMPL-20260225-01
 */

import NextAuth from "next-auth"
import { authOptions } from "@/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
